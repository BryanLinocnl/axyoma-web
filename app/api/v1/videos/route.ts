import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import { getBalance, checkRateLimit, getBillingConfig } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import { resolveModel, RegionNotAllowedError, isRegionAllowed, healModelRegion, videoPricePerSecondUsd } from '@/lib/model-registry'
import { getAccessToken } from '@/lib/google-auth'
import { buildLongRunningUrl } from '@/lib/vertex'

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
const DEFAULT_DURATION_S = 8
const MIN_DURATION_S = 4
const MAX_DURATION_S = 8

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

  // 2) Rate limit por usuário (custo/abuso). Fail-open se a RPC não existir.
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
  if (!resolved || resolved.provider !== 'vertex' || resolved.api_flavor !== 'veo') {
    return json(400, { error: { message: 'modelo de vídeo não disponível', type: 'bad_request' } })
  }
  const region = resolved.region
  if (!region) {
    console.error('modelo veo sem region', model)
    return json(500, { error: { message: 'modelo mal configurado', type: 'config' } })
  }

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
        const estCostUsd = durationSeconds * pricePerSecond * margin
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

  // 8) Corpo do :predictLongRunning. sampleCount:1 (um vídeo por chamada). O frame
  // inicial (se houver) vai como `image` na instância.
  const instance: Record<string, unknown> = { prompt }
  if (imageRef) instance.image = imageRef
  const submitBody = {
    instances: [instance],
    parameters: { sampleCount: 1, durationSeconds, aspectRatio },
  }

  const submit = (reg: string): Promise<Response> =>
    fetch(buildLongRunningUrl(reg, projectId, resolved.upstream_model_id, 'predictLongRunning', resolved.vertex_publisher ?? 'google'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submitBody),
    })

  const regionUsed = region
  let upstream: Response
  try {
    upstream = await submit(regionUsed)
  } catch (e) {
    console.error('vertex predictLongRunning rede', (e as Error).message)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  // 9) FALLBACK DE REGIÃO + AUTO-HEAL: se a região configurada não serve o modelo
  // (404) e a região tentada != 'global' E 'global' passar pela allow-list, RETENTA
  // UMA vez com 'global' (sem loop). Ao vencer, grava a região em public.models.
  let healedRegion: string | null = null
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    if (regionUsed !== VERTEX_FALLBACK_REGION && isRegionAllowed(VERTEX_FALLBACK_REGION) && upstream.status === 404) {
      try {
        const retry = await submit(VERTEX_FALLBACK_REGION)
        if (retry.ok) {
          upstream = retry
          healedRegion = VERTEX_FALLBACK_REGION
        } else {
          const rdetail = await retry.text().catch(() => '')
          console.error('vertex video submit retry global não-ok', retry.status, rdetail || retry.statusText)
          return json(retry.status || 502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
        }
      } catch (e) {
        console.error('vertex video submit retry global falhou', (e as Error).message)
        return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
      }
    } else {
      console.error('vertex video submit não-ok', upstream.status, detail || upstream.statusText)
      return json(upstream.status || 502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
    }
  }

  // Auto-heal fire-and-forget (grava a região vencedora; não bloqueia a resposta).
  if (healedRegion) healModelRegion(resolved.id, healedRegion)

  const data = (await upstream.json().catch(() => null)) as { name?: unknown } | null
  const operationId = typeof data?.name === 'string' ? data.name : null
  if (!operationId) {
    console.error('vertex video submit sem operation name')
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
        duration_seconds: durationSeconds,
        status: 'submitted',
      }),
    })
    if (!ins.ok && ins.status !== 409) {
      console.error('video_charges submit insert falhou', ins.status, await ins.text().catch(() => ''))
      return json(502, { error: { message: 'falha ao registrar operação de vídeo', type: 'upstream' } })
    }
  } catch (e) {
    console.error('video_charges submit insert rede', (e as Error).message)
    return json(502, { error: { message: 'falha ao registrar operação de vídeo', type: 'upstream' } })
  }

  // Devolve o operationId (name completo) + o id canônico do modelo, que o client
  // repassa ao /status. A DURAÇÃO cobrada NÃO vem mais do client: é lida da linha
  // gravada acima (server-side). `durationSeconds` no retorno é só informativo.
  return json(200, { operationId, model: resolved.id, durationSeconds })
}
