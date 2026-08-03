import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import {
  getBalance,
  checkRateLimit,
  recordPendingCharge,
  holdCredits,
  settleHold,
  releaseHold,
  InsufficientCreditsError,
} from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import { insufficientCreditsError } from '@/lib/credit-errors'
import { resolveModel, RegionNotAllowedError } from '@/lib/model-registry'
import { getAccessToken } from '@/lib/google-auth'
import { buildGenerateContentUrl, extractInlineAudio, pcmToWav, sampleRateFromMime } from '@/lib/vertex'

// Geração de FALA (texto → áudio). Mesmo modelo de segurança das demais rotas de
// mídia: verifica JWT → rate limit → reserva crédito → chama o Vertex com a
// credencial WIF do servidor → cobra o custo real → devolve o áudio.
//
// POR QUE A RESPOSTA É BINÁRIA, e não JSON como a de imagem: fala é grande e
// efêmera. Um clipe de um minuto em PCM 24 kHz são ~2,9 MB, que viram ~3,9 MB se
// forem passados por base64 dentro de um JSON — 35% de banda jogada fora em cada
// chamada, dos dois lados. E, ao contrário da imagem, não há galeria: o app toca
// ou salva o arquivo e segue. Por isso o corpo é o WAV puro e o que a imagem
// devolve no JSON (custo, créditos) vem em cabeçalho `X-*`.
//
// POR QUE NÃO VAI PARA O STORAGE: a rota de imagem persiste porque existe
// `image_generations` e uma tela que relista. Fala não tem nem tabela nem tela;
// criar bucket e linha para um arquivo que o cliente já está recebendo seria
// inventar retenção de dado que ninguém pediu — e áudio de voz é justamente a
// categoria em que guardar por padrão é a decisão errada.
export const runtime = 'edge'

const DEFAULT_SPEECH_MODEL = 'google/gemini-2.5-flash-preview-tts'

// Teto de texto por chamada. Não é limite do modelo (a janela é bem maior): é
// limite de RESPOSTA — cada caractere vira ~1 KB de WAV, então 5 000 caracteres
// já são ~5 MB de corpo. Passar disto é caso de dividir em pedaços no cliente,
// que também é o que dá barra de progresso.
const MAX_TEXT = Number(process.env.SPEECH_MAX_TEXT ?? 5000)
const MAX_BODY_BYTES = Number(process.env.SPEECH_MAX_BODY_BYTES ?? 32 * 1024)
const RATE_LIMIT = Number(process.env.SPEECH_RATE_LIMIT ?? 20)
const RATE_WINDOW_S = Number(process.env.SPEECH_RATE_WINDOW_S ?? 60)
const MIN_CHARGE_USD = Number(process.env.SPEECH_MIN_CHARGE_USD ?? 0.001)
const HOLD_CREDITS = Number(process.env.SPEECH_HOLD_CREDITS ?? 4)

// Taxa de amostragem assumida quando NEM o mimeType da resposta NEM a tabela
// declaram uma. É a que o Gemini TTS usa hoje; existe só para o WAV nunca sair
// com cabeçalho zerado (que toca em velocidade errada em vez de falhar).
const FALLBACK_SAMPLE_RATE = 24000

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_TEXT),
  model: z.string().min(1).max(200).optional(),
  // Nome da voz. A lista válida vem de `metadata.voices` do modelo — fica na
  // tabela, não aqui, para uma voz nova entrar sem deploy.
  voice: z.string().min(1).max(64).optional(),
})

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
}

/** base64 cru → bytes, sem APIs do Node (a rota roda no edge). */
function base64ToBytes(b64: string): Uint8Array {
  const comma = b64.indexOf(',')
  const clean = b64.startsWith('data:') && comma >= 0 ? b64.slice(comma + 1) : b64
  const bin = atob(clean)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Lê `metadata.voices` como lista de strings. Ausente/malformado → null (não valida). */
function vozesPermitidas(metadata: Record<string, unknown> | null): Set<string> | null {
  const raw = metadata?.voices
  if (!Array.isArray(raw)) return null
  const nomes = raw.filter((v): v is string => typeof v === 'string' && v.length > 0)
  return nomes.length > 0 ? new Set(nomes) : null
}

type VertexUsageMetadata = {
  promptTokenCount?: number
  candidatesTokenCount?: number
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

  // 2) Rate limit por usuário. FAIL-CLOSED: esta rota gasta dinheiro nosso.
  const rl = await checkRateLimit({ userId, bucket: 'speech', limit: RATE_LIMIT, windowSeconds: RATE_WINDOW_S })
  if (!rl.allowed) {
    const retry = rl.resetAt ? Math.max(1, Math.ceil((Date.parse(rl.resetAt) - Date.now()) / 1000)) : RATE_WINDOW_S
    return json(
      429,
      { error: { message: 'muitas gerações de áudio — aguarde e tente de novo', type: 'rate_limited' } },
      { 'Retry-After': String(retry) },
    )
  }

  // 3) Saldo lido só para o delta exibido; o gate de verdade é a RESERVA adiante.
  try {
    await getBalance(userId)
  } catch (e) {
    console.error('getBalance (fala) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha ao checar saldo', type: 'upstream' } })
  }

  // 4) Validação de input.
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
    return json(400, {
      error: { message: `parâmetros inválidos (texto de 1 a ${MAX_TEXT} caracteres)`, type: 'bad_request' },
    })
  }
  const text = parsed.data.text.trim()
  if (!text) return json(400, { error: { message: 'texto obrigatório', type: 'bad_request' } })
  const model = parsed.data.model ?? DEFAULT_SPEECH_MODEL

  // 5) Resolução na tabela. Aqui a tabela é ALLOW-LIST, não overlay: sem linha,
  // sem geração. É o oposto do fail-open da rota de imagem, e de propósito — lá
  // existe um caminho OpenRouter que independe da tabela; aqui não existe outro
  // caminho, então "não achei" só pode virar recusa. Mensagens seguem o 4.1 da
  // spec de protocolos: cada situação tem a sua, porque cada uma tem uma
  // correção diferente.
  let resolved
  try {
    resolved = await resolveModel(model)
  } catch (e) {
    if (e instanceof RegionNotAllowedError) {
      return json(400, { error: { message: 'região do modelo não permitida', type: 'bad_request' } })
    }
    console.error('resolveModel (fala) falhou', (e as Error).message)
    return json(502, { error: { message: 'catálogo de modelos indisponível', type: 'upstream' } })
  }
  if (!resolved) {
    return json(404, { error: { message: `modelo "${model}" não está no catálogo`, type: 'not_found' } })
  }
  if (resolved.provider !== 'vertex' || resolved.api_flavor !== 'gemini_tts') {
    return json(404, { error: { message: `"${model}" não gera fala`, type: 'not_found' } })
  }

  // GUARD de preço: sem preço de saída configurado NÃO gera (não entrega áudio
  // de graça). Mesmo guard do ramo Vertex de imagem.
  const outPrice = resolved.output_price_usd_per_mtok
  if (!(outPrice > 0)) {
    return json(400, { error: { message: 'preço de fala não configurado', type: 'config' } })
  }

  // Voz: valida contra a lista da tabela. Voz desconhecida é 400 com a lista, e
  // não um 500 vindo do Vertex — quem errou o nome precisa ver os nomes certos.
  const permitidas = vozesPermitidas(resolved.metadata)
  const vozPadrao =
    typeof resolved.metadata?.default_voice === 'string' ? (resolved.metadata.default_voice as string) : 'Kore'
  const voice = parsed.data.voice ?? vozPadrao
  if (permitidas && !permitidas.has(voice)) {
    return json(400, {
      error: { message: `voz "${voice}" não existe — use uma de: ${[...permitidas].join(', ')}`, type: 'bad_request' },
    })
  }

  // region já validada contra a allow-list no resolveModel (anti-SSRF).
  const region = resolved.region
  if (!region) {
    console.error('modelo vertex de fala sem region', model)
    return json(500, { error: { message: 'modelo mal configurado', type: 'config' } })
  }
  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) return json(500, { error: { message: 'GCP_PROJECT_ID ausente', type: 'config' } })

  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    console.error('getAccessToken (fala) falhou', (e as Error).message)
    return json(502, { error: { message: 'falha de autenticação com o provedor', type: 'upstream' } })
  }

  const url = buildGenerateContentUrl(region, projectId, resolved.upstream_model_id, resolved.vertex_publisher ?? 'google')

  // 6) RESERVA antes de gastar no upstream (A-1). `allowBonus` true: é modelo
  // Vertex, e a franquia de cadastro paga Vertex.
  let holdId: string
  try {
    holdId = await holdCredits({ userId, credits: HOLD_CREDITS, kind: 'speech', model, allowBonus: true })
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return json(402, await insufficientCreditsError(userId))
    }
    console.error('reserva de créditos (fala) falhou:', (e as Error).message)
    return json(502, { error: { message: 'serviço indisponível', type: 'upstream' } })
  }

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    })
  } catch (e) {
    console.error('vertex tts rede', (e as Error).message)
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  if (!upstream.ok) {
    // Detalhe só no log do servidor: a resposta do Vertex pode ecoar o corpo
    // enviado, e o corpo aqui é o texto do usuário.
    const detail = await upstream.text().catch(() => '')
    console.error('vertex tts não-ok', upstream.status, detail || upstream.statusText)
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  const data = (await upstream.json().catch(() => null)) as
    | { usageMetadata?: VertexUsageMetadata }
    | null
  const audio = data ? extractInlineAudio(data) : null
  if (!audio) {
    console.error('vertex tts sem áudio nas parts')
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'modelo não retornou áudio', type: 'upstream' } })
  }

  // 7) PCM cru → WAV. Sem isto o cliente recebe bytes que nenhum player abre.
  let wav: Uint8Array
  try {
    const declarada = Number(resolved.metadata?.sample_rate_hz)
    const fallback = Number.isFinite(declarada) && declarada > 0 ? declarada : FALLBACK_SAMPLE_RATE
    wav = pcmToWav(base64ToBytes(audio.data), sampleRateFromMime(audio.mimeType, fallback))
  } catch (e) {
    console.error('tts decode/wav falhou', (e as Error).message)
    await releaseHold(holdId).catch(() => {})
    return json(502, { error: { message: 'áudio em formato inesperado', type: 'upstream' } })
  }

  // 8) Cobrança pelo uso REAL. Entrada (texto) e saída (áudio) têm tabelas de
  // preço diferentes e o Vertex conta as duas em `usageMetadata`. Sem usage,
  // cobra o mínimo — nunca zero, senão uma resposta sem metadados vira fala de
  // graça.
  const usage = data?.usageMetadata
  const inTok = Number(usage?.promptTokenCount ?? 0)
  const outTok = Number(usage?.candidatesTokenCount ?? 0)
  const calculado = (inTok * resolved.input_price_usd_per_mtok + outTok * outPrice) / 1e6
  const costUsd = calculado > 0 ? calculado : MIN_CHARGE_USD

  let creditsCharged: number | null = null
  try {
    const charged = await settleHold({
      holdId,
      costUsd,
      model,
      promptTokens: inTok || undefined,
      completionTokens: outTok || undefined,
    })
    creditsCharged = charged > 0 ? charged : null
  } catch (e) {
    // Falha no débito não descarta o áudio já gerado. Não retenta (evita dupla
    // cobrança) — registra marcador de reconciliação.
    console.error('debit fala falhou', (e as Error).message)
    await recordPendingCharge({
      userId,
      kind: 'speech',
      model,
      costUsd,
      reason: `debit failed: ${(e as Error).message}`,
    })
  }

  // 9) WAV puro no corpo; custo e créditos em cabeçalho (ver nota do topo).
  // `X-*` precisam ir em Access-Control-Expose-Headers, senão o browser lê o
  // corpo e não enxerga os cabeçalhos — falha silenciosa clássica de CORS.
  return new Response(wav as unknown as BodyInit, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/wav',
      'Content-Length': String(wav.length),
      'Cache-Control': 'no-store',
      'X-Model': model,
      'X-Voice': voice,
      'X-Cost-Usd': String(costUsd),
      'X-Credits-Charged': creditsCharged == null ? '' : String(creditsCharged),
      'Access-Control-Expose-Headers': 'X-Model, X-Voice, X-Cost-Usd, X-Credits-Charged',
    },
  })
}
