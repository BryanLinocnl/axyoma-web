import { verifyUser } from '@/lib/auth'
import { getBalance, debitUsage, recordPendingCharge, checkRateLimit } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import {
  resolveModel,
  RegionNotAllowedError,
  isRegionAllowed,
  videoPricePerSecondUsd,
  healModelRegion,
} from '@/lib/model-registry'
import { getAccessToken } from '@/lib/google-auth'
import { buildLongRunningUrl } from '@/lib/vertex'

// Geração de VÍDEO (Veo) — POLL/STATUS assíncrono. O client chama isto em loop com
// o `operationId` devolvido por POST /api/v1/videos. Fluxo por chamada:
//   verifyUser → resolveModel(model) [vertex/veo, region+upstream+preço/segundo] →
//   access token WIF → POST :fetchPredictOperation { operationName } →
//   se !done: { status:'running' } ;
//   se done: extrai videos[0].bytesBase64Encoded, SOBE no Storage privado (bucket
//   'generations', path video/<uid>/<uuid>.mp4, service-role — MESMO padrão do
//   route de imagens), DEBITA UMA vez (cost = durationSeconds × price_per_second_usd,
//   margem via CREDIT_MARGIN_MULTIPLIER), assina a URL e responde { status:'done', ... }.
//
// ANTI-SSRF: o `op` é validado (precisa ser um nome de operação da própria Vertex,
// não uma URL arbitrária) e a URL de :fetchPredictOperation é montada a partir da
// region/upstream do MODELO (registry, allow-list) — NUNCA a partir de host do
// client. O `op` só entra no CORPO, como `operationName`.
//
// LEDGER + ISOLAMENTO: a linha em `video_charges(op PK)` é criada NO SUBMIT com a
// DURAÇÃO real e status 'submitted'. Aqui a duração cobrada vem SEMPRE dela (nunca do
// query param → sem subcobrança) e toda leitura/claim é ESCOPADA por user_id (um `op`
// inexistente OU de outro usuário → 404; nunca assinamos/cobramos o op alheio).
//
// IDEMPOTÊNCIA DE COBRANÇA: o client polla, então o `done` pode chegar 2+ vezes →
// risco de dupla cobrança. Mitigado com um CLAIM condicional: UPDATE
// 'submitted' -> 'charging' (filtro status=eq.submitted + user_id). Exatamente 1 poll
// vence o update e é o único que sobe/debita/finaliza (path + status 'done'); os
// demais leem a linha e devolvem o resultado (done se path preenchido, senão running).
export const runtime = 'edge'

const VERTEX_FALLBACK_REGION = 'global'
const BUCKET = 'generations'
// Fallback conservador de duração se a linha do ledger vier sem duration_seconds
// (não deveria — o submit sempre grava): nunca subcobrar → usa o teto.
const MAX_DURATION_S = 8

// FIX 3 — rate limit FOLGADO no /status (polling legítimo é frequente). Fail-open.
const STATUS_RATE_LIMIT = Number(process.env.VIDEO_STATUS_RATE_LIMIT ?? 120)
const STATUS_RATE_WINDOW_S = Number(process.env.VIDEO_STATUS_RATE_WINDOW_S ?? 60)

// FIX 4 — cap do tamanho do base64 do vídeo vindo do upstream ANTES de decodificar
// (protege a memória do isolate edge). ~24 MB de base64 (≈18 MB de binário).
const VIDEO_MAX_B64_BYTES = Number(process.env.VIDEO_MAX_B64_BYTES ?? 24 * 1024 * 1024)

// Nome de operação da Vertex: projects/.../locations/.../.../operations/<id>. Só
// caracteres seguros; DEVE começar com 'projects/' e conter '/operations/'. Isto NÃO
// vira host (montamos a URL do registry) — a validação é defesa em profundidade.
const OP_RE = /^projects\/[A-Za-z0-9._/-]*\/operations\/[A-Za-z0-9._-]+$/
const OP_MAX_LEN = 512

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'GET, OPTIONS') })
}

// --- Storage (bucket privado, service-role) — MESMO padrão do route de imagens ---
async function uploadToStorage(
  supaUrl: string,
  serviceRole: string,
  objectPath: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const up = await fetch(`${supaUrl}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Blob([bytes], { type: contentType }),
  })
  if (!up.ok) return { ok: false, detail: (await up.text().catch(() => '')) || up.statusText }
  return { ok: true }
}

async function signObjectUrl(supaUrl: string, serviceRole: string, objectPath: string): Promise<string | null> {
  const sign = await fetch(`${supaUrl}/storage/v1/object/sign/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (sign.ok) {
    const s = (await sign.json().catch(() => null)) as { signedURL?: string } | null
    if (s?.signedURL) return `${supaUrl}/storage/v1${s.signedURL}`
  }
  return null
}

// Converte base64 CRU (sem prefixo data:) em bytes — edge-safe (atob + Uint8Array).
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const comma = b64.indexOf(',')
  const clean = b64.startsWith('data:') && comma >= 0 ? b64.slice(comma + 1) : b64
  const bin = atob(clean)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// --- Ledger da operação em video_charges (LINHA criada no SUBMIT) -----------------
// A linha JÁ EXISTE (gravada no submit com status 'submitted' + duration_seconds).
// Aqui só LEMOS (escopado por user_id — anti-IDOR) e fazemos o CLAIM condicional
// 'submitted' -> 'charging' pra eleger 1 vencedor da cobrança (idempotência).

type ChargeRow = {
  status: string | null
  path: string | null
  credits: number | null
  model: string | null
  durationSeconds: number | null
}

// Leitura ESCOPADA por user_id (FIX 2): um `op` de outro usuário nunca é lido/assinado
// no contexto do requisitante — retorna null (o chamador responde 404).
async function getChargeRow(
  supaUrl: string,
  serviceRole: string,
  op: string,
  userId: string,
): Promise<ChargeRow | null> {
  const qs = new URLSearchParams({
    op: `eq.${op}`,
    user_id: `eq.${userId}`,
    select: 'status,path,credits,model,duration_seconds',
    limit: '1',
  })
  const res = await fetch(`${supaUrl}/rest/v1/video_charges?${qs.toString()}`, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  })
  if (!res.ok) return null
  const rows = (await res.json().catch(() => [])) as {
    status?: string
    path?: string
    credits?: number
    model?: string
    duration_seconds?: number
  }[]
  const row = rows[0]
  if (!row) return null
  return {
    status: typeof row.status === 'string' ? row.status : null,
    path: typeof row.path === 'string' ? row.path : null,
    credits: typeof row.credits === 'number' ? row.credits : null,
    model: typeof row.model === 'string' ? row.model : null,
    durationSeconds: Number.isInteger(row.duration_seconds) ? (row.duration_seconds as number) : null,
  }
}

// CLAIM (FIX 7): UPDATE condicional 'submitted' -> 'charging', filtrado por
// op + user_id + status=eq.submitted (escopo anti-IDOR). return=representation devolve
// as linhas efetivamente atualizadas: exatamente 1 poll vence (>=1 linha), os demais
// recebem 0 linhas (já reivindicado/finalizado) e caem no re-read.
async function claimCharge(
  supaUrl: string,
  serviceRole: string,
  op: string,
  userId: string,
): Promise<{ won: boolean } | { error: true }> {
  let res: Response
  try {
    const qs = new URLSearchParams({ op: `eq.${op}`, user_id: `eq.${userId}`, status: 'eq.submitted' })
    res = await fetch(`${supaUrl}/rest/v1/video_charges?${qs.toString()}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: 'charging' }),
    })
  } catch (e) {
    console.error('video_charges claim rede', (e as Error).message)
    return { error: true }
  }
  if (!res.ok) {
    console.error('video_charges claim não-ok', res.status, await res.text().catch(() => ''))
    return { error: true }
  }
  const rows = (await res.json().catch(() => [])) as unknown[]
  return { won: Array.isArray(rows) && rows.length > 0 }
}

// Finalize ESCOPADO por user_id (grava path/credits/cost_usd → status 'done').
async function finalizeCharge(
  supaUrl: string,
  serviceRole: string,
  op: string,
  userId: string,
  fields: { path: string; credits: number | null; costUsd: number },
): Promise<void> {
  const qs = new URLSearchParams({ op: `eq.${op}`, user_id: `eq.${userId}` })
  await fetch(`${supaUrl}/rest/v1/video_charges?${qs.toString()}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ path: fields.path, credits: fields.credits ?? 0, cost_usd: fields.costUsd, status: 'done' }),
  }).catch((e) => console.error('video_charges finalize falhou', (e as Error).message))
}

// Linha em image_generations (best-effort; reusa a tabela existente, image_url = path
// do vídeo). Não falha a resposta se o insert falhar.
async function insertGenerationRow(supaUrl: string, serviceRole: string, row: Record<string, unknown>): Promise<void> {
  try {
    const ins = await fetch(`${supaUrl}/rest/v1/image_generations`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })
    if (!ins.ok) console.error('insert image_generations (video) falhou', await ins.text().catch(() => ''))
  } catch (e) {
    console.error('insert image_generations (video) rede', (e as Error).message)
  }
}

export async function GET(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'GET, OPTIONS')
  const json = (status: number, body: unknown, extra?: Record<string, string>): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS, ...(extra ?? {}) },
    })

  // 1) Autenticação.
  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // 2) FIX 3 — Rate limit FOLGADO no /status (polling legítimo). Fail-open.
  const rl = await checkRateLimit({
    userId,
    bucket: 'video_status',
    limit: STATUS_RATE_LIMIT,
    windowSeconds: STATUS_RATE_WINDOW_S,
  })
  if (!rl.allowed) {
    const retry = rl.resetAt ? Math.max(1, Math.ceil((Date.parse(rl.resetAt) - Date.now()) / 1000)) : STATUS_RATE_WINDOW_S
    return json(
      429,
      { error: { message: 'muitas consultas — aguarde e tente de novo', type: 'rate_limited' } },
      { 'Retry-After': String(retry) },
    )
  }

  // 3) Query params. `op` é validado (defesa em profundidade — a URL de poll é montada
  // do registry, não do op). `model` do query é só FALLBACK do model gravado no ledger.
  const url = new URL(req.url)
  const op = (url.searchParams.get('op') ?? '').trim()
  const modelParam = (url.searchParams.get('model') ?? '').trim()

  if (!op || op.length > OP_MAX_LEN || !OP_RE.test(op)) {
    return json(400, { error: { message: 'operação inválida', type: 'bad_request' } })
  }

  // 4) Config server-only.
  const supaUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceRole) {
    return json(500, { error: { message: 'SUPABASE_URL/SERVICE_ROLE_KEY ausentes', type: 'config' } })
  }
  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) return json(500, { error: { message: 'GCP_PROJECT_ID ausente', type: 'config' } })

  // 5) LEDGER: lê a linha do `op` ESCOPADA por user_id (FIX 1 + FIX 2). Se não existir
  // (op inválido OU de outro usuário) → 404. É a fonte de verdade da DURAÇÃO cobrada e
  // do isolamento entre usuários (nunca assinamos/cobramos o op de outro).
  const chargeRow = await getChargeRow(supaUrl, serviceRole, op, userId)
  if (!chargeRow) {
    return json(404, { error: { message: 'operação não encontrada', type: 'not_found' } })
  }

  // Curto-circuito de idempotência (sem tocar a Vertex):
  //  - 'done' com path → já processada: assina e devolve.
  //  - 'charging' (ou 'done' sem path, defensivo) → vencedor em andamento → running.
  if (chargeRow.status === 'done') {
    if (chargeRow.path) {
      const signedUrl = await signObjectUrl(supaUrl, serviceRole, chargeRow.path)
      return json(200, { status: 'done', url: signedUrl, path: chargeRow.path, credits: chargeRow.credits })
    }
    return json(200, { status: 'running' })
  }
  if (chargeRow.status === 'charging') {
    return json(200, { status: 'running' })
  }

  // FIX 1 — a DURAÇÃO cobrada vem SEMPRE do ledger (server-side), nunca do query param.
  // Fallback conservador ao teto se, por algum motivo, a coluna vier vazia (nunca
  // subcobra). O `model` também é o gravado no submit (fallback ao query param).
  if (chargeRow.durationSeconds == null) {
    console.error('video_charges sem duration_seconds — usando teto conservador', op)
  }
  const durationSeconds = chargeRow.durationSeconds ?? MAX_DURATION_S
  const model = chargeRow.model ?? modelParam
  if (!model) {
    console.error('video_charges sem model e sem model no query', op)
    return json(500, { error: { message: 'operação mal configurada', type: 'config' } })
  }

  // 6) Resolve o modelo (region/upstream/preço). Exige vertex/veo. A URL de poll é
  // montada a partir DAQUI (registry), nunca do client → anti-SSRF.
  let resolved
  try {
    resolved = await resolveModel(model)
  } catch (e) {
    if (e instanceof RegionNotAllowedError) {
      return json(400, { error: { message: 'região do modelo não permitida', type: 'bad_request' } })
    }
    console.error('resolveModel (video status) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha ao resolver o modelo', type: 'upstream' } })
  }
  if (!resolved || resolved.provider !== 'vertex' || resolved.api_flavor !== 'veo') {
    return json(400, { error: { message: 'modelo de vídeo não disponível', type: 'bad_request' } })
  }
  const region = resolved.region
  if (!region) {
    console.error('modelo veo sem region', model)
    return json(500, { error: { message: 'modelo mal configurado', type: 'config' } })
  }

  // GUARD de preço: sem price_per_second_usd (>0) NÃO cobramos → recusa de config.
  const pricePerSecond = videoPricePerSecondUsd(resolved)
  if (pricePerSecond == null) {
    console.error('modelo veo sem price_per_second_usd', model)
    return json(500, { error: { message: 'preço de vídeo não configurado', type: 'config' } })
  }

  // 5) Access token WIF (nunca logado/retornado).
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    console.error('getAccessToken (video status) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha de autenticação com o provedor', type: 'upstream' } })
  }

  // 6) POST :fetchPredictOperation { operationName: op }. URL do registry; op só no corpo.
  const poll = (reg: string): Promise<Response> =>
    fetch(buildLongRunningUrl(reg, projectId, resolved.upstream_model_id, 'fetchPredictOperation', resolved.vertex_publisher ?? 'google'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName: op }),
    })

  let upstream: Response
  try {
    upstream = await poll(region)
  } catch (e) {
    console.error('vertex fetchPredictOperation rede', (e as Error).message)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }
  // Fallback de região (404) → 'global' UMA vez (best-effort; a operação pode ter
  // sido submetida em 'global' via auto-heal). Sem auto-heal aqui (o submit já cuida).
  if (!upstream.ok && region !== VERTEX_FALLBACK_REGION && isRegionAllowed(VERTEX_FALLBACK_REGION) && upstream.status === 404) {
    try {
      const retry = await poll(VERTEX_FALLBACK_REGION)
      if (retry.ok) upstream = retry
    } catch (e) {
      console.error('vertex fetchPredictOperation retry global falhou', (e as Error).message)
    }
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    console.error('vertex fetchPredictOperation não-ok', upstream.status, detail || upstream.statusText)
    return json(upstream.status || 502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  const data = (await upstream.json().catch(() => null)) as
    | { done?: unknown; response?: { videos?: { bytesBase64Encoded?: unknown; mimeType?: unknown }[] } }
    | null
  if (!data) return json(502, { error: { message: 'resposta inválida do provedor', type: 'upstream' } })

  // 7) Ainda rodando? (done ausente/null/false). Devolve running — o client re-polla.
  if (data.done !== true) {
    return json(200, { status: 'running' })
  }

  const videos = data.response?.videos
  const b64 = Array.isArray(videos) && typeof videos[0]?.bytesBase64Encoded === 'string' ? videos[0]!.bytesBase64Encoded : null
  const mimeType = Array.isArray(videos) && typeof videos[0]?.mimeType === 'string' && videos[0]!.mimeType ? videos[0]!.mimeType! : 'video/mp4'
  if (!b64) {
    console.error('vertex video done sem bytesBase64Encoded')
    return json(502, { error: { message: 'operação concluída sem vídeo', type: 'upstream' } })
  }

  // FIX 4 — cap de tamanho: recusa ANTES de decodificar (atob aloca ~length bytes;
  // um base64 gigante estouraria a memória do isolate edge).
  if (b64.length > VIDEO_MAX_B64_BYTES) {
    console.error('vertex video base64 acima do cap', b64.length, VIDEO_MAX_B64_BYTES)
    return json(502, { error: { message: 'vídeo grande demais', type: 'upstream' } })
  }

  // 8) IDEMPOTÊNCIA (FIX 7): CLAIM condicional 'submitted' -> 'charging' (escopo user_id).
  // Só 1 poll vence e sobe/debita/finaliza; os demais leem a linha e devolvem o
  // resultado (done se path preenchido, senão running).
  const claim = await claimCharge(supaUrl, serviceRole, op, userId)
  if ('error' in claim) {
    // Erro de DB no claim: não é seguro subir/debitar (poderia duplicar). Peça re-poll.
    return json(502, { error: { message: 'falha ao processar operação', type: 'upstream' } })
  }
  if (!claim.won) {
    // Outro poll reivindicou. Relê a linha (escopada) pra decidir done/running.
    const fresh = await getChargeRow(supaUrl, serviceRole, op, userId)
    if (fresh?.status === 'done' && fresh.path) {
      const signedUrl = await signObjectUrl(supaUrl, serviceRole, fresh.path)
      return json(200, { status: 'done', url: signedUrl, path: fresh.path, credits: fresh.credits })
    }
    return json(200, { status: 'running' })
  }

  // 9) VENCEDOR: decodifica + sobe no Storage (bucket privado, service-role). Path força
  // a pasta 'video/<uid>/…'.
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = base64ToBytes(b64)
  } catch (e) {
    console.error('vertex video decode base64 falhou', (e as Error).message)
    return json(502, { error: { message: 'falha ao decodificar vídeo', type: 'upstream' } })
  }
  const id = crypto.randomUUID()
  const objectPath = `video/${userId}/${id}.mp4`
  const up = await uploadToStorage(supaUrl, serviceRole, objectPath, bytes, mimeType)
  if (!up.ok) {
    console.error('vertex video storage upload falhou', up.detail)
    return json(502, { error: { message: 'falha ao salvar vídeo', type: 'upstream' } })
  }

  // 10) COBRANÇA UMA vez: cost = durationSeconds × price_per_second_usd, onde
  // durationSeconds é a ARMAZENADA no ledger (FIX 1) — nunca o query param do client.
  // Margem via CREDIT_MARGIN_MULTIPLIER dentro do debitUsage. Créditos = delta de saldo.
  const costUsd = durationSeconds * pricePerSecond
  let creditsCharged: number | null = null
  let balanceBefore = 0
  try {
    balanceBefore = await getBalance(userId).catch(() => 0)
    await debitUsage({ userId, costUsd, model })
    const balanceAfter = await getBalance(userId).catch(() => balanceBefore)
    const delta = balanceBefore - balanceAfter
    creditsCharged = delta > 0 ? delta : null
  } catch (e) {
    // Débito falhou: não descartamos o vídeo já gerado/salvo. Não retenta (evita
    // dupla cobrança) — marca para reconciliação.
    console.error('debit video falhou', (e as Error).message)
    await recordPendingCharge({ userId, kind: 'video', model, costUsd, reason: `debit failed: ${(e as Error).message}` })
  }

  // 11) Finaliza o claim (grava path/credits → status done). Polls seguintes leem daqui.
  await finalizeCharge(supaUrl, serviceRole, op, userId, { path: objectPath, credits: creditsCharged, costUsd })

  // 12) Linha em image_generations (best-effort; reusa a tabela existente).
  await insertGenerationRow(supaUrl, serviceRole, {
    id,
    user_id: userId,
    prompt: `[video] ${op}`,
    model,
    image_url: objectPath,
    status: 'completed',
    credits: creditsCharged ?? 0,
  })

  // 13) URL assinada para exibição imediata (bucket privado).
  const signedUrl = await signObjectUrl(supaUrl, serviceRole, objectPath)

  return json(200, { status: 'done', url: signedUrl, path: objectPath, credits: creditsCharged })
}
