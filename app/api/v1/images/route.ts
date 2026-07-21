import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import { getBalance, debitUsage, checkRateLimit, recordPendingCharge } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import { resolveModel, RegionNotAllowedError, type ResolvedModel } from '@/lib/model-registry'
import { getAccessToken } from '@/lib/google-auth'
import { buildGenerateContentUrl, extractInlineImages } from '@/lib/vertex'

// Geração de imagem (Playground P6). Mesmo modelo de segurança do proxy de chat:
// verifica JWT → gate de saldo → injeta a chave real da OpenRouter (server-only)
// → gera a imagem → sobe para o Storage privado com a service-role → debita os
// créditos no banco → devolve a linha + URL assinada. A chave da OpenRouter e a
// service-role NUNCA saem daqui; o client só recebe a URL assinada.
export const runtime = 'edge'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const BUCKET = 'generations'

// Modelo de imagem padrão na OpenRouter (image-capable via /chat/completions com
// modalities). Overridável pelo body, mas restrito à allow-list abaixo para o
// route de imagem não virar um proxy genérico para modelos caros de texto.
const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image-preview'
const IMAGE_MODELS = new Set<string>([
  'google/gemini-2.5-flash-image-preview',
  'google/gemini-2.5-flash-image',
])

const MAX_PROMPT = 2000
const MAX_BODY_BYTES = Number(process.env.IMAGE_MAX_BODY_BYTES ?? 32 * 1024) // 32 KB
const RATE_LIMIT = Number(process.env.IMAGE_RATE_LIMIT ?? 10) // req / janela / usuário
const RATE_WINDOW_S = Number(process.env.IMAGE_RATE_WINDOW_S ?? 60)
const MIN_CHARGE_USD = Number(process.env.IMAGE_MIN_CHARGE_USD ?? 0.001)

const BodySchema = z
  .object({
    prompt: z.string().min(1).max(MAX_PROMPT),
    model: z.string().min(1).max(200).optional(),
  })
  .passthrough()

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
}

interface Usage {
  cost?: number
  prompt_tokens?: number
  completion_tokens?: number
}

// Extrai o data-URL da imagem da resposta da OpenRouter, tolerando os formatos
// conhecidos (message.images[] e content[] com image_url).
function extractImageDataUrl(data: unknown): string | null {
  const d = data as { choices?: { message?: Record<string, unknown> }[] }
  const msg = d.choices?.[0]?.message
  if (!msg) return null

  const images = msg.images as { image_url?: { url?: string }; url?: string }[] | undefined
  if (Array.isArray(images)) {
    for (const img of images) {
      const url = img?.image_url?.url ?? img?.url
      if (typeof url === 'string' && url.startsWith('data:')) return url
    }
  }

  const content = msg.content as
    | { type?: string; image_url?: { url?: string } | string }[]
    | string
    | undefined
  if (Array.isArray(content)) {
    for (const part of content) {
      const iu = part?.image_url
      const url = typeof iu === 'string' ? iu : iu?.url
      if (typeof url === 'string' && url.startsWith('data:')) return url
    }
  }
  return null
}

function dataUrlToBytes(u: string): { bytes: Uint8Array<ArrayBuffer>; contentType: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(u)
  if (!m) throw new Error('formato de imagem inesperado')
  const contentType = m[1]
  const bin = atob(m[2])
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, contentType }
}

function extToMime(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  return 'png'
}

// Converte base64 CRU (sem prefixo `data:`, como o Vertex generateContent devolve)
// em bytes. Mesma técnica edge-safe do `dataUrlToBytes` (atob + Uint8Array), sem
// APIs do Node. Tolera um eventual prefixo `data:...,` por robustez.
function base64ToBytes(b64: string, mimeType: string): { bytes: Uint8Array<ArrayBuffer>; contentType: string } {
  const comma = b64.indexOf(',')
  const clean = b64.startsWith('data:') && comma >= 0 ? b64.slice(comma + 1) : b64
  const bin = atob(clean)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, contentType: mimeType || 'image/png' }
}

// --- Fluxo de persistência compartilhado (OpenRouter + Vertex) ---------------
// O path força a pasta do usuário (`${uid}/…`) — as policies `gen_*` do bucket
// exigem isso. Sobe com a service-role (server-only).
async function uploadImageToStorage(
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

// Insere a linha em image_generations (service-role). `image_url` guarda o PATH do
// Storage (não a URL assinada, que expira); o client assina sob demanda. Devolve a
// linha persistida (representation) ou o próprio `row` em caso de falha do insert.
async function insertGenerationRow(
  supaUrl: string,
  serviceRole: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const ins = await fetch(`${supaUrl}/rest/v1/image_generations`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (ins.ok) {
    const rows = (await ins.json().catch(() => [])) as Record<string, unknown>[]
    if (rows[0]) return rows[0]
  } else {
    console.error('insert image_generations falhou', await ins.text().catch(() => ''))
  }
  return row
}

// URL assinada para exibição imediata (bucket privado). Null se a assinatura falhar.
async function signObjectUrl(
  supaUrl: string,
  serviceRole: string,
  objectPath: string,
): Promise<string | null> {
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

export async function POST(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'POST, OPTIONS')
  const json = (status: number, body: unknown, extra?: Record<string, string>): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS, ...(extra ?? {}) },
    })

  // 1) Autenticação (local, sem tocar o Supabase).
  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // 2) Rate limit por usuário (custo/abuso). Fail-open se a RPC não existir.
  const rl = await checkRateLimit({ userId, bucket: 'image', limit: RATE_LIMIT, windowSeconds: RATE_WINDOW_S })
  if (!rl.allowed) {
    const retry = rl.resetAt ? Math.max(1, Math.ceil((Date.parse(rl.resetAt) - Date.now()) / 1000)) : RATE_WINDOW_S
    return json(
      429,
      { error: { message: 'muitas gerações — aguarde e tente de novo', type: 'rate_limited' } },
      { 'Retry-After': String(retry) },
    )
  }

  // 3) Gate de saldo — protege a chave antes de qualquer chamada externa.
  let balanceBefore: number
  try {
    balanceBefore = await getBalance(userId)
    if (!(balanceBefore > 0)) {
      return json(402, { error: { message: 'créditos esgotados', type: 'insufficient_credits' } })
    }
  } catch (e) {
    return json(502, { error: { message: `falha ao checar saldo: ${(e as Error).message}`, type: 'upstream' } })
  }

  // 4) Validação de input (cap de tamanho + zod + allow-list de modelo).
  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return json(413, { error: { message: 'corpo grande demais', type: 'bad_request' } })
  }
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return json(400, { error: { message: 'corpo inválido', type: 'bad_request' } })
  }
  const parsed = BodySchema.safeParse(parsedBody)
  if (!parsed.success) {
    return json(400, { error: { message: 'parâmetros inválidos', type: 'bad_request' } })
  }
  const prompt = parsed.data.prompt.trim()
  if (!prompt) return json(400, { error: { message: 'prompt obrigatório', type: 'bad_request' } })
  const requested = parsed.data.model ?? DEFAULT_IMAGE_MODEL
  if (!IMAGE_MODELS.has(requested)) {
    return json(400, { error: { message: 'modelo de imagem não permitido', type: 'bad_request' } })
  }
  const model = requested

  // 4) Config server-only (compartilhada por ambos os ramos — Storage/DB).
  const supaUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceRole) {
    return json(500, { error: { message: 'SUPABASE_URL/SERVICE_ROLE_KEY ausentes', type: 'config' } })
  }

  // 4b) RESOLUÇÃO OVERLAY: a tabela public.models é a fonte de verdade de
  // roteamento. Achou E provider==='vertex' && api_flavor==='gemini_image' →
  // RAMO VERTEX (generateContent nativo). Senão (não achou, ou outro
  // provider/flavor) → FALLBACK OpenRouter (o caminho ATUAL, 100% intacto).
  // A region de modelos Vertex é validada no resolveModel (anti-SSRF).
  let resolved
  try {
    resolved = await resolveModel(model)
  } catch (e) {
    if (e instanceof RegionNotAllowedError) {
      return json(400, { error: { message: 'região do modelo não permitida', type: 'bad_request' } })
    }
    // Falha transitória no lookup da tabela (não é region inválida): FAIL-OPEN
    // para o caminho OpenRouter (que independe da tabela). Assim uma indisponibilidade
    // momentânea do registry não derruba a geração de imagem via OpenRouter (comportamento
    // pré-existente). Modelos Vertex, esses sim, dependem do lookup e cairão no fallback
    // (onde a allow-list IMAGE_MODELS decide) — aceitável e raro.
    console.error('resolveModel (imagem) falhou — fail-open p/ OpenRouter', (e as Error).message)
    resolved = null
  }

  if (resolved && resolved.provider === 'vertex' && resolved.api_flavor === 'gemini_image') {
    return generateVertexImage({
      resolved,
      userId,
      prompt,
      model,
      supaUrl,
      serviceRole,
      balanceBefore,
      json,
    })
  }

  // 4c) Config exclusiva do ramo OpenRouter (chave real só existe aqui).
  const key = process.env.OPENROUTER_KEY
  if (!key) return json(500, { error: { message: 'OPENROUTER_KEY ausente', type: 'config' } })

  // 5) Geração via OpenRouter (chave real só existe aqui).
  const upstream = await fetch(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://axyoma-ai.app',
      'X-Title': 'AXYOMA AI',
    },
    body: JSON.stringify({
      model,
      modalities: ['image', 'text'],
      messages: [{ role: 'user', content: prompt }],
      usage: { include: true },
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json(upstream.status || 502, {
      error: { message: `openrouter: ${detail || upstream.statusText}`, type: 'upstream' },
    })
  }

  const data = (await upstream.json().catch(() => null)) as { usage?: Usage } | null
  const dataUrl = data ? extractImageDataUrl(data) : null
  if (!dataUrl) {
    return json(502, { error: { message: 'modelo não retornou imagem', type: 'upstream' } })
  }

  let bytes: Uint8Array<ArrayBuffer>
  let contentType: string
  try {
    ;({ bytes, contentType } = dataUrlToBytes(dataUrl))
  } catch (e) {
    return json(502, { error: { message: (e as Error).message, type: 'upstream' } })
  }

  // 6) Upload para o Storage privado com a service-role. O path força a pasta do
  // usuário (`${uid}/…`) — as policies `gen_*` do bucket exigem isso.
  const id = crypto.randomUUID()
  const objectPath = `${userId}/${id}.${extToMime(contentType)}`
  const up = await uploadImageToStorage(supaUrl, serviceRole, objectPath, bytes, contentType)
  if (!up.ok) {
    console.error('storage upload falhou', up.detail)
    return json(502, { error: { message: 'falha ao salvar imagem', type: 'upstream' } })
  }

  // 7) Débito dos créditos (mesma RPC do chat). A conversão USD→créditos é feita
  // no banco. O nº de créditos gravado na linha vem do delta de saldo real —
  // sem duplicar a fórmula de conversão no código.
  const usage = data?.usage
  let creditsCharged: number | null = null
  // Toda geração debita: usa o custo real quando presente; senão cobra o mínimo.
  const costUsd =
    usage && typeof usage.cost === 'number' && usage.cost >= 0 ? usage.cost : MIN_CHARGE_USD
  try {
    await debitUsage({
      userId,
      costUsd,
      model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
    })
    const balanceAfter = await getBalance(userId).catch(() => balanceBefore)
    const delta = balanceBefore - balanceAfter
    creditsCharged = delta > 0 ? delta : null
  } catch (e) {
    // Falha no débito não descarta a imagem já gerada/salva. Não retenta (evita
    // dupla cobrança) — registra marcador de reconciliação.
    console.error('debit imagem falhou', (e as Error).message)
    await recordPendingCharge({
      userId,
      kind: 'image',
      model,
      costUsd,
      reason: `debit failed: ${(e as Error).message}`,
    })
  }

  // 8) Insere a linha em image_generations (service-role). `image_url` guarda o
  // PATH do Storage (não a URL assinada, que expira); o client assina sob demanda.
  const row = {
    id,
    user_id: userId,
    prompt,
    model,
    image_url: objectPath,
    status: 'completed',
    // `credits` é NOT NULL default 0: um null explícito faz o insert FALHAR
    // (o default só vale quando o campo é OMITIDO). Coalesce p/ garantir que a
    // linha sempre persista mesmo quando o débito não rendeu delta (>0).
    credits: creditsCharged ?? 0,
  }
  const saved = await insertGenerationRow(supaUrl, serviceRole, row)

  // 9) URL assinada para exibição imediata (bucket privado).
  const signedUrl = await signObjectUrl(supaUrl, serviceRole, objectPath)

  return json(200, { image: saved, path: objectPath, signedUrl, credits: creditsCharged })
}

// -----------------------------------------------------------------------------
// RAMO VERTEX — geração de imagem via endpoint NATIVO :generateContent.
// Reusa o MESMO fluxo de Storage/insert/sign do ramo OpenRouter e devolve a
// resposta no MESMO formato (o client não muda). A COBRANÇA é FLAT por imagem:
// custo_usd = nº_imagens × image_price_usd. Débito SEMPRE que gerar imagem.
// SEGURANÇA: access token/credenciais nunca em log/erro/response; region só via
// model-registry (allow-list, anti-SSRF); erro do upstream é scrubbed (mensagem
// genérica ao client, detalhe só em console.error).
// -----------------------------------------------------------------------------
async function generateVertexImage(args: {
  resolved: ResolvedModel
  userId: string
  prompt: string
  model: string
  supaUrl: string
  serviceRole: string
  balanceBefore: number
  json: (status: number, body: unknown, extra?: Record<string, string>) => Response
}): Promise<Response> {
  const { resolved, userId, prompt, model, supaUrl, serviceRole, balanceBefore, json } = args

  // GUARD de preço: sem preço configurado (>0) NÃO gera (evita imagem de graça).
  const priceUsd = resolved.image_price_usd
  if (priceUsd == null || !(priceUsd > 0)) {
    return json(400, { error: { message: 'preço de imagem não configurado', type: 'config' } })
  }

  // region já foi validada contra a allow-list no resolveModel (anti-SSRF).
  const region = resolved.region
  if (!region) {
    console.error('modelo vertex de imagem sem region', model)
    return json(500, { error: { message: 'modelo mal configurado', type: 'config' } })
  }
  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) return json(500, { error: { message: 'GCP_PROJECT_ID ausente', type: 'config' } })

  // Access token WIF (nunca logado/retornado).
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    console.error('getAccessToken (imagem vertex) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha de autenticação com o provedor', type: 'upstream' } })
  }

  const url = buildGenerateContentUrl(region, projectId, resolved.upstream_model_id, resolved.vertex_publisher ?? 'google')

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    })
  } catch (e) {
    console.error('vertex generateContent rede', (e as Error).message)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    console.error('vertex generateContent não-ok', upstream.status, detail || upstream.statusText)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  const data = await upstream.json().catch(() => null)
  const images = data ? extractInlineImages(data) : []
  if (images.length === 0) {
    console.error('vertex generateContent sem imagem nas parts')
    return json(502, { error: { message: 'modelo não retornou imagem', type: 'upstream' } })
  }

  // Sobe cada imagem PRIMEIRO. Só cobramos pelas que foram efetivamente
  // persistidas (o client só recebe essas) — consistente com o ramo OpenRouter,
  // que não debita se o upload falha. No caminho normal, persisted == retornadas.
  const uploaded: { id: string; objectPath: string }[] = []
  for (const img of images) {
    let bytes: Uint8Array<ArrayBuffer>
    let contentType: string
    try {
      ;({ bytes, contentType } = base64ToBytes(img.data, img.mimeType))
    } catch (e) {
      console.error('vertex decode base64 falhou', (e as Error).message)
      continue
    }
    const id = crypto.randomUUID()
    const objectPath = `${userId}/${id}.${extToMime(contentType)}`
    const up = await uploadImageToStorage(supaUrl, serviceRole, objectPath, bytes, contentType)
    if (!up.ok) {
      console.error('vertex storage upload falhou', up.detail)
      continue
    }
    uploaded.push({ id, objectPath })
  }
  if (uploaded.length === 0) {
    return json(502, { error: { message: 'falha ao salvar imagem', type: 'upstream' } })
  }

  // COBRANÇA FLAT por imagem: custo = nº_imagens × image_price_usd. Um único
  // débito para o lote (mesma RPC do chat; margem via CREDIT_MARGIN_MULTIPLIER é
  // tratada dentro do debitUsage). O nº de créditos vem do delta de saldo real.
  const costUsd = uploaded.length * priceUsd
  let creditsCharged: number | null = null
  try {
    await debitUsage({ userId, costUsd, model })
    const balanceAfter = await getBalance(userId).catch(() => balanceBefore)
    const delta = balanceBefore - balanceAfter
    creditsCharged = delta > 0 ? delta : null
  } catch (e) {
    // Falha no débito não descarta as imagens já salvas. Não retenta (evita dupla
    // cobrança) — registra marcador de reconciliação.
    console.error('debit imagem (vertex) falhou', (e as Error).message)
    await recordPendingCharge({
      userId,
      kind: 'image',
      model,
      costUsd,
      reason: `debit failed: ${(e as Error).message}`,
    })
  }

  // Insere uma linha por imagem + assina a URL. O crédito do lote é atribuído à
  // PRIMEIRA linha (0 nas demais) para o somatório de `credits` bater com o débito
  // único. `credits` é NOT NULL default 0 → coalesce evita insert falhando.
  const results: { image: Record<string, unknown>; path: string; signedUrl: string | null }[] = []
  for (let i = 0; i < uploaded.length; i++) {
    const { id, objectPath } = uploaded[i]
    const row = {
      id,
      user_id: userId,
      prompt,
      model,
      image_url: objectPath,
      status: 'completed',
      credits: i === 0 ? (creditsCharged ?? 0) : 0,
    }
    const saved = await insertGenerationRow(supaUrl, serviceRole, row)
    const signedUrl = await signObjectUrl(supaUrl, serviceRole, objectPath)
    results.push({ image: saved, path: objectPath, signedUrl })
  }

  // MESMO formato do ramo OpenRouter (image/path/signedUrl/credits). Quando há mais
  // de uma imagem, expõe `images[]` ADITIVO (não quebra clients que leem só o topo).
  const primary = results[0]
  return json(200, {
    image: primary.image,
    path: primary.path,
    signedUrl: primary.signedUrl,
    credits: creditsCharged,
    ...(results.length > 1 ? { images: results } : {}),
  })
}
