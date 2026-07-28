import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import {
  getBalance,
  checkRateLimit,
  getBillingConfig,
  holdCredits,
  releaseHold,
  InsufficientCreditsError,
} from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import {
  resolveModel,
  RegionNotAllowedError,
  isRegionAllowed,
  healModelRegion,
  videoPricePerSecondUsd,
  VIDEO_FLAVORS,
} from '@/lib/model-registry'
import { getAccessToken } from '@/lib/google-auth'
import { buildLongRunningUrl, buildInteractionsUrl, INTERACTION_NAME_RE } from '@/lib/vertex'

// Geração de VÍDEO (Veo) — SUBMIT assíncrono. Mesmo modelo de segurança das outras
// rotas de proxy: verifica JWT → rate-limit → gate de saldo → resolve o modelo na
// tabela `public.models` (fonte de verdade de roteamento, com validação de região
// anti-SSRF) → injeta o access token WIF (server-only) → dispara a operação
// long-running no Vertex (`:predictLongRunning`) e devolve o `operationId` para o
// client pollar em /api/v1/videos/status. NÃO DEBITA AQUI: a cobrança acontece
// UMA vez, no status, quando a operação conclui (done). O access token/credencial
// NUNCA sai daqui nem entra em log/erro/response; erro do upstream é scrubbed.
export const runtime = 'edge'

// SÓ 404 dispara o fallback de região + auto-heal (mesma heurística do chat/imagem):
// a Vertex responde 404 quando o modelo não serve na location pedida. 401/403/429/5xx
// NÃO são disso e seguem o tratamento normal (não retentar auth/quota/erro de servidor).
const VERTEX_FALLBACK_REGION = 'global'

const MAX_PROMPT = 2000
// Cap maior que o de imagem: o body pode carregar um frame inicial (data URL base64).
const MAX_BODY_BYTES = Number(process.env.VIDEO_MAX_BODY_BYTES ?? 10 * 1024 * 1024) // 10 MB
const RATE_LIMIT = Number(process.env.VIDEO_RATE_LIMIT ?? 5) // req / janela / usuário
const RATE_WINDOW_S = Number(process.env.VIDEO_RATE_WINDOW_S ?? 60)
// Teto conservador de reserva quando não dá para estimar pelo preço/segundo.
const HOLD_CREDITS_FALLBACK = Number(process.env.VIDEO_HOLD_CREDITS ?? 120)
const DEFAULT_DURATION_S = 8
const MIN_DURATION_S = 4
const MAX_DURATION_S = 8

// Duração FIXA do Gemini Omni Flash em preview: o corpo da Interactions API não
// aceita parâmetro de duração e o modelo devolve sempre ~10s (medido). Como a
// cobrança é por segundo, gravar os 8s que o client pede no ledger subcobraria
// 20% de cada geração — por isso o valor real entra aqui e ignora o client.
const OMNI_DURATION_S = 10

// FIX 5 — gate de custo: fator de segurança conservador aplicado à estimativa de
// créditos exigida no saldo antes de disparar a geração. >=1 encarece a exigência
// (mais protetivo); default 1 (exige exatamente a estimativa). Só bloqueia quando o
// saldo é CLARAMENTE insuficiente — nunca bloqueia geração legítima por folga.
const VIDEO_MIN_BALANCE_MULT = (() => {
  const n = Number(process.env.VIDEO_MIN_BALANCE_USD_MULT ?? 1)
  return Number.isFinite(n) && n > 0 ? n : 1
})()

const BodySchema = z
  .object({
    prompt: z.string().min(1).max(MAX_PROMPT),
    model: z.string().min(1).max(200),
    durationSeconds: z.number().int().min(MIN_DURATION_S).max(MAX_DURATION_S).optional(),
    // Proporção do vídeo: 16:9 (widescreen) ou 9:16 (vertical). Default 16:9.
    aspectRatio: z.enum(['16:9', '9:16']).optional().default('16:9'),
    // Frame inicial opcional: SOMENTE data URL base64 (http(s):// é IGNORADA — nunca
    // baixamos URL de referência, anti-SSRF).
    image: z.string().min(1).max(MAX_BODY_BYTES).optional(),
    // Vídeo de referência (edição/composição). Só a flavor `interactions` aceita;
    // o Veo ignora. Mesma regra do `image`: data URL base64, nada de http(s).
    video: z.string().min(1).max(MAX_BODY_BYTES).optional(),
  })
  .passthrough()

const DATA_URL_RE = /^data:([^;,]+);base64,([\s\S]+)$/

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
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

  // 2) Rate limit por usuário (custo/abuso). FAIL-CLOSED: vídeo é a geração mais
  // cara do produto; sem limitador confiável, não passa.
  const rl = await checkRateLimit({ userId, bucket: 'video', limit: RATE_LIMIT, windowSeconds: RATE_WINDOW_S })
  if (!rl.allowed) {
    const retry = rl.resetAt ? Math.max(1, Math.ceil((Date.parse(rl.resetAt) - Date.now()) / 1000)) : RATE_WINDOW_S
    return json(
      429,
      { error: { message: 'muitas gerações — aguarde e tente de novo', type: 'rate_limited' } },
      { 'Retry-After': String(retry) },
    )
  }

  // 3) Gate de saldo — protege a chave antes de qualquer chamada externa. Vídeo é
  // caro; exigimos saldo > 0 (a cobrança real, por duração, ocorre no done/status).
  let balanceBefore: number
  try {
    balanceBefore = await getBalance(userId)
    if (!(balanceBefore > 0)) {
      return json(402, { error: { message: 'créditos esgotados', type: 'insufficient_credits' } })
    }
  } catch (e) {
    // FIX 6 — scrub: o detalhe do erro (que pode carregar contexto de infra) só vai
    // pro log do servidor; o client recebe mensagem genérica.
    console.error('getBalance (video submit) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha ao checar saldo', type: 'upstream' } })
  }

  // 4) Validação de input (cap de tamanho + zod).
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
  const model = parsed.data.model.trim()
  const durationSeconds = parsed.data.durationSeconds ?? DEFAULT_DURATION_S
  const aspectRatio = parsed.data.aspectRatio

  // Frame inicial opcional: só aceitamos data URL base64. Qualquer outra coisa é
  // ignorada silenciosamente (não é erro; simplesmente não vira image ref).
  let imageRef: { bytesBase64Encoded: string; mimeType: string } | null = null
  if (parsed.data.image) {
    const m = DATA_URL_RE.exec(parsed.data.image.trim())
    if (m) imageRef = { mimeType: m[1], bytesBase64Encoded: m[2] }
  }
  let videoRef: { bytesBase64Encoded: string; mimeType: string } | null = null
  if (parsed.data.video) {
    const m = DATA_URL_RE.exec(parsed.data.video.trim())
    if (m) videoRef = { mimeType: m[1], bytesBase64Encoded: m[2] }
  }

  // 5) Config server-only.
  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) return json(500, { error: { message: 'GCP_PROJECT_ID ausente', type: 'config' } })

  // 6) RESOLUÇÃO: a tabela public.models é a fonte de verdade. Exigimos
  // provider === 'vertex' && api_flavor === 'veo' — senão esta rota não atende o
  // modelo (400). A região de modelos Vertex é validada no resolveModel (anti-SSRF).
  let resolved
  try {
    resolved = await resolveModel(model)
  } catch (e) {
    if (e instanceof RegionNotAllowedError) {
      return json(400, { error: { message: 'região do modelo não permitida', type: 'bad_request' } })
    }
    console.error('resolveModel (video) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha ao resolver o modelo', type: 'upstream' } })
  }
  if (!resolved || resolved.provider !== 'vertex' || !VIDEO_FLAVORS.has(resolved.api_flavor)) {
    return json(400, { error: { message: 'modelo de vídeo não disponível', type: 'bad_request' } })
  }
  const region = resolved.region
  if (!region) {
    console.error('modelo de vídeo sem region', model)
    return json(500, { error: { message: 'modelo mal configurado', type: 'config' } })
  }
  const isOmni = resolved.api_flavor === 'interactions'
  // A duração cobrada é a REAL, não a pedida — ver OMNI_DURATION_S.
  const billedSeconds = isOmni ? OMNI_DURATION_S : durationSeconds

  // 6b) GATE DE CUSTO (FIX 5): saldo > 0 não basta — vídeo é caro e a cobrança real
  // (por duração) só ocorre no done/status. Estimamos o custo em CRÉDITOS aqui e
  // exigimos que o saldo o cubra, para impedir submissão com saldo CLARAMENTE
  // insuficiente (ex.: 1 crédito p/ um vídeo de 8s).
  //
  // Créditos = custoUSD × usd_brl_rate / credit_brl, onde custoUSD =
  // durationSeconds × price_per_second_usd × margem. Margem = CREDIT_MARGIN_MULTIPLIER
  // se setada, senão billing_config.margin_multiplier. A conversão precisa de
  // usd_brl_rate/credit_brl (billing_config, via RPC). Se NÃO der pra calcular
  // créditos confiáveis (config ausente/rate 0/erro), NÃO bloqueamos — mantemos só o
  // gate de saldo>0 já feito acima (prioridade: não barrar geração legítima).
  const pricePerSecond = videoPricePerSecondUsd(resolved)
  if (pricePerSecond != null) {
    try {
      const cfg = await getBillingConfig()
      const envMargin = Number(process.env.CREDIT_MARGIN_MULTIPLIER)
      const margin =
        Number.isFinite(envMargin) && envMargin > 0
          ? envMargin
          : cfg.margin_multiplier > 0
            ? cfg.margin_multiplier
            : 1
      if (cfg.usd_brl_rate > 0 && cfg.credit_brl > 0) {
        const estCostUsd = billedSeconds * pricePerSecond * margin
        const estCredits = (estCostUsd * cfg.usd_brl_rate) / cfg.credit_brl
        const required = estCredits * VIDEO_MIN_BALANCE_MULT
        if (required > 0 && balanceBefore < required) {
          return json(402, { error: { message: 'créditos insuficientes para esta geração', type: 'insufficient_credits' } })
        }
      }
    } catch (e) {
      // Fail-open: erro ao ler billing_config não bloqueia (saldo>0 já garantido).
      console.error('gate de custo (video submit) indisponível (fail-open)', (e as Error).message)
    }
  }

  // 7) Access token WIF (nunca logado/retornado).
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    console.error('getAccessToken (video submit) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha de autenticação com o provedor', type: 'upstream' } })
  }

  // 8) SUBMIT. As duas flavors divergem em endpoint, corpo e formato do id da
  // operação — só o que vem antes e depois é compartilhado.
  //
  //   veo          POST publishers/google/models/{id}:predictLongRunning
  //                { instances:[{prompt, image?}], parameters:{...} }
  //                id = data.name  (…/operations/…)
  //
  //   interactions POST v1beta1/projects/{p}/locations/global/interactions
  //                { model, input:[partes], response_format, background:true }
  //                id = data.name  (…/interactions/…)
  //
  // `background:true` é o que torna o Omni pollável e faz ele caber no fluxo
  // submit→poll que o app já tem. Sem isso a chamada bloquearia até o vídeo
  // ficar pronto e estouraria o teto de 300s da função.
  const submitUrl = isOmni
    ? buildInteractionsUrl(projectId)
    : buildLongRunningUrl(
        region,
        projectId,
        resolved.upstream_model_id,
        'predictLongRunning',
        resolved.vertex_publisher ?? 'google',
      )

  const buildBody = (): Record<string, unknown> => {
    if (!isOmni) {
      const instance: Record<string, unknown> = { prompt }
      if (imageRef) instance.image = imageRef
      return { instances: [instance], parameters: { sampleCount: 1, durationSeconds, aspectRatio } }
    }
    // A ordem importa: as referências primeiro, a instrução por último — é como
    // o modelo foi sondado e como os exemplos da Interactions API montam o input.
    const input: Record<string, unknown>[] = []
    if (videoRef) {
      input.push({ type: 'video', data: videoRef.bytesBase64Encoded, mime_type: videoRef.mimeType })
    }
    if (imageRef) {
      input.push({ type: 'image', data: imageRef.bytesBase64Encoded, mime_type: imageRef.mimeType })
    }
    input.push({ type: 'text', text: prompt })
    return {
      model: resolved.upstream_model_id,
      input,
      response_format: { type: 'video', aspect_ratio: aspectRatio },
      background: true,
    }
  }
  const submitBody = buildBody()

  const submit = (reg: string): Promise<Response> =>
    fetch(
      isOmni
        ? submitUrl
        : buildLongRunningUrl(
            reg,
            projectId,
            resolved.upstream_model_id,
            'predictLongRunning',
            resolved.vertex_publisher ?? 'google',
          ),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitBody),
      },
    )

  // 8b) RESERVA de créditos (auditoria A-1). O gate acima é uma LEITURA de saldo:
  // N submits simultâneos liam o mesmo valor e todos passavam, enquanto o débito
  // real só acontece quando o polling vê `done` — minutos e vários vídeos depois.
  // A reserva é atômica no banco e vira o gate de verdade. Como a liquidação
  // acontece em OUTRA invocação (o /status), o id da reserva é gravado no ledger.
  //
  // A estimativa usa o preço real por segundo quando disponível (via billing
  // config); sem isso, cai num teto conservador — reservar de menos reabriria a
  // corrida que esta mudança fecha.
  let holdCreditsAmount = HOLD_CREDITS_FALLBACK
  if (pricePerSecond != null) {
    try {
      const cfg = await getBillingConfig()
      const envMargin = Number(process.env.CREDIT_MARGIN_MULTIPLIER)
      const margin =
        Number.isFinite(envMargin) && envMargin > 0 ? envMargin : cfg.margin_multiplier > 0 ? cfg.margin_multiplier : 1
      if (cfg.usd_brl_rate > 0 && cfg.credit_brl > 0) {
        const est = (billedSeconds * pricePerSecond * margin * cfg.usd_brl_rate) / cfg.credit_brl
        if (est > 0) holdCreditsAmount = Math.ceil(est)
      }
    } catch (e) {
      console.error('estimativa de reserva (video) indisponível — usando fallback', (e as Error).message)
    }
  }

  let holdId: string
  try {
    // Vídeo é Veo, na Vertex: a franquia de cadastro paga.
    holdId = await holdCredits({ userId, credits: holdCreditsAmount, kind: 'video', model: resolved.id, allowBonus: true })
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return json(402, { error: { message: 'créditos insuficientes para esta geração', type: 'insufficient_credits' } })
    }
    console.error('reserva de créditos (video) falhou:', (e as Error).message)
    return json(502, { error: { message: 'serviço indisponível', type: 'upstream' } })
  }

  const regionUsed = region
  let upstream: Response
  try {
    upstream = await submit(regionUsed)
  } catch (e) {
    console.error('vertex predictLongRunning rede', (e as Error).message)
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  // 9) FALLBACK DE REGIÃO + AUTO-HEAL: se a região configurada não serve o modelo
  // (404) e a região tentada != 'global' E 'global' passar pela allow-list, RETENTA
  // UMA vez com 'global' (sem loop). Ao vencer, grava a região em public.models.
  let healedRegion: string | null = null
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    // O fallback de região não se aplica ao Omni: a coleção de interactions só
    // existe em `global`, e a URL nem carrega a região. Retentar seria repetir a
    // MESMA chamada e gravar uma região "curada" que não muda nada.
    if (!isOmni && regionUsed !== VERTEX_FALLBACK_REGION && isRegionAllowed(VERTEX_FALLBACK_REGION) && upstream.status === 404) {
      try {
        const retry = await submit(VERTEX_FALLBACK_REGION)
        if (retry.ok) {
          upstream = retry
          healedRegion = VERTEX_FALLBACK_REGION
        } else {
          const rdetail = await retry.text().catch(() => '')
          console.error('vertex video submit retry global não-ok', retry.status, rdetail || retry.statusText)
          await releaseHold(holdId).catch(() => {})
          return json(retry.status || 502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
        }
      } catch (e) {
        console.error('vertex video submit retry global falhou', (e as Error).message)
        await releaseHold(holdId).catch(() => {})
        return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
      }
    } else {
      console.error('vertex video submit não-ok', upstream.status, detail || upstream.statusText)
      await releaseHold(holdId).catch(() => {})
      return json(upstream.status || 502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
    }
  }

  // Auto-heal fire-and-forget (grava a região vencedora; não bloqueia a resposta).
  if (healedRegion) healModelRegion(resolved.id, healedRegion)

  const data = (await upstream.json().catch(() => null)) as { name?: unknown } | null
  const operationId = typeof data?.name === 'string' ? data.name : null
  if (!operationId) {
    console.error('vertex video submit sem operation name')
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'provedor não retornou operação', type: 'upstream' } })
  }
  // O nome volta do UPSTREAM, não do client, mas é ele que o /status vai
  // interpolar numa URL. Conferir o formato aqui é mais barato que descobrir no
  // poll que a operação é impollável — e mantém a mesma postura das outras
  // rotas: nada entra em URL sem passar por uma regex.
  if (isOmni && !INTERACTION_NAME_RE.test(operationId)) {
    console.error('interactions submit com name fora do formato', operationId.slice(0, 120))
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'provedor não retornou operação', type: 'upstream' } })
  }

  // FIX 1 — LEDGER NO SUBMIT: grava a linha em video_charges com a DURAÇÃO REAL
  // submetida (fonte de verdade da cobrança) + user_id + model, status 'submitted'.
  // O /status passa a cobrar SEMPRE por esta duration_seconds — nunca por query param
  // do client — e usa a existência+escopo desta linha (user_id) como validação do op.
  // Se não conseguirmos registrar, a operação ficaria "órfã" (o /status 404aria): é
  // erro (502) — o client pode reenviar. 409 = op já registrado (idempotente → ok).
  const supaUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceRole) {
    console.error('video_charges submit insert: SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
    await releaseHold(holdId).catch(() => {})
    return json(500, { error: { message: 'config de billing ausente', type: 'config' } })
  }
  try {
    const ins = await fetch(`${supaUrl}/rest/v1/video_charges`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        op: operationId,
        user_id: userId,
        model: resolved.id,
        duration_seconds: billedSeconds,
        status: 'submitted',
        hold_id: holdId,
      }),
    })
    if (!ins.ok && ins.status !== 409) {
      console.error('video_charges submit insert falhou', ins.status, await ins.text().catch(() => ''))
      await releaseHold(holdId).catch(() => {})
      return json(502, { error: { message: 'falha ao registrar operação de vídeo', type: 'upstream' } })
    }
  } catch (e) {
    console.error('video_charges submit insert rede', (e as Error).message)
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'falha ao registrar operação de vídeo', type: 'upstream' } })
  }

  // Devolve o operationId (name completo) + o id canônico do modelo, que o client
  // repassa ao /status. A DURAÇÃO cobrada NÃO vem mais do client: é lida da linha
  // gravada acima (server-side). `durationSeconds` no retorno é só informativo.
  return json(200, { operationId, model: resolved.id, durationSeconds })
}
