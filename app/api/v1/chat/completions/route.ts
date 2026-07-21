import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import {
  getBalance,
  debitUsage,
  checkRateLimit,
  recordPendingCharge,
  getSpendTodayUsd,
} from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import { resolveModel, RegionNotAllowedError, type ResolvedModel } from '@/lib/model-registry'
import { getAccessToken } from '@/lib/google-auth'
import {
  callVertex,
  usageFromDataPayload,
  buildGenerateContentUrl,
  extractInlineImages,
  type VertexUsage,
} from '@/lib/vertex'
import { costUsd } from '@/lib/cost'

// Proxy de chat completions (OpenAI-compatible), streaming pass-through.
// Fluxo: verifica JWT → rate limit → checa saldo → valida corpo (zod + allow-list
// de modelo + caps) → injeta a chave real → repassa o SSE da OpenRouter ao app,
// lendo o `usage.cost` do chunk final para debitar no fim.
//
// INTEGRIDADE DE CRÉDITO (Fase 3):
//   * O dreno do upstream é DESACOPLADO do consumo do client: se o usuário aperta
//     Stop / desconecta, seguimos lendo o upstream server-side até o fim para que
//     `usage.cost` chegue e o débito ocorra. Nunca cancelamos o upstream por
//     abort do client (senão haveria completion parcial de graça).
//   * Fallback: se `usage.cost` não vier, cobramos um mínimo (CHAT_MIN_CHARGE_USD);
//     se o débito lançar, registramos marcador de reconciliação (sem cobrança
//     dupla). Assim toda geração debita.
export const runtime = 'edge'

const OPENROUTER = 'https://openrouter.ai/api/v1'

// Limites (documentados). Overrides por env quando fizer sentido em produção.
const RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT ?? 30) // req / janela / usuário
const RATE_WINDOW_S = Number(process.env.CHAT_RATE_WINDOW_S ?? 60)
// Cap de corpo: precisa acomodar IMAGENS de entrada (visão + edição imagem-para-imagem),
// cujo base64 tem alguns MB. Gated por auth + rate-limit + saldo, então um corpo maior não é
// vetor de abuso relevante. Overridável por env. (Texto puro fica muito abaixo disso.)
const MAX_BODY_BYTES = Number(process.env.CHAT_MAX_BODY_BYTES ?? 16 * 1024 * 1024) // 16 MB
const MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS ?? 32000)
const MAX_MESSAGES = 200
const MIN_CHARGE_USD = Number(process.env.CHAT_MIN_CHARGE_USD ?? 0.0002)

// Cap de gasto diário (§7). DESABILITADO por padrão: env vazia/0 => sem limite
// (comportamento atual). Quando > 0, o gate pré-request soma o gasto USD do dia
// (usage_log) e barra com 402. Entregue desabilitado, mas com o código presente.
const DAILY_SPEND_CAP_USD = Number(process.env.DAILY_SPEND_CAP_USD ?? 0)

// Allow-list de modelos (opcional): se `CHAT_MODEL_ALLOWLIST` estiver setado
// (comma), só esses modelos passam. Caso contrário, política sã: modelo bem
// formado + caps de tamanho/tokens (impede pedir max_tokens absurdo/corpo gigante).
function modelAllowList(): Set<string> | null {
  const raw = process.env.CHAT_MODEL_ALLOWLIST
  if (!raw) return null
  const set = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
  return set.size > 0 ? set : null
}

const MessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool', 'developer']),
    content: z.union([z.string(), z.array(z.unknown()), z.null()]).optional(),
  })
  .passthrough()

const BodySchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
    max_tokens: z.number().int().positive().max(MAX_TOKENS).optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
  })
  .passthrough() // deixa passar tools/stop/etc. para a OpenRouter

interface Usage {
  cost?: number
  prompt_tokens?: number
  completion_tokens?: number
}

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
}

// Partes aceitas pelo generateContent (o que montamos a partir das messages).
type GenTextPart = { text: string }
type GenInlinePart = { inlineData: { mimeType: string; data: string } }
type GenPart = GenTextPart | GenInlinePart

// data:<mime>;base64,<b64>  — só data URLs base64 viram inlineData. Qualquer
// http(s):// é IGNORADA (anti-SSRF: NUNCA baixamos URL de referência).
const DATA_URL_RE = /^data:([^;,]+);base64,([\s\S]+)$/

/**
 * Converte as `messages` OpenAI recebidas em `parts` do generateContent.
 *
 * - Junta o texto de TODAS as mensagens role='user' (a última domina, pois é o
 *   prompt principal + refs) em UMA part {text}.
 * - Cada `image_url` cujo `url` seja uma DATA URL base64 vira {inlineData}.
 * - `image_url` http(s):// é ignorada (não baixamos nada — anti-SSRF). String de
 *   conteúdo simples é tratada como texto.
 * Ordem final: a part de texto primeiro, depois as imagens (formato confirmado).
 */
function messagesToImageParts(messages: unknown): GenPart[] {
  const texts: string[] = []
  const images: GenInlinePart[] = []
  if (!Array.isArray(messages)) return []

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    const m = msg as Record<string, unknown>
    if (m.role !== 'user') continue
    const content = m.content
    if (typeof content === 'string') {
      if (content.trim()) texts.push(content)
      continue
    }
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') {
        if (p.text.trim()) texts.push(p.text)
      } else if (p.type === 'image_url') {
        const url = (p.image_url as { url?: unknown } | undefined)?.url
        if (typeof url !== 'string') continue
        const match = DATA_URL_RE.exec(url.trim())
        if (match) {
          // Só data URL base64 vira ref inline. http(s) é ignorada (anti-SSRF).
          images.push({ inlineData: { mimeType: match[1], data: match[2] } })
        }
      }
    }
  }

  const parts: GenPart[] = []
  const joined = texts.join('\n').trim()
  if (joined) parts.push({ text: joined })
  parts.push(...images)
  return parts
}

/** Extrai o texto concatenado das parts de texto da resposta generateContent. */
function extractText(data: unknown): string {
  const candidates = (data as { candidates?: unknown })?.candidates
  if (!Array.isArray(candidates)) return ''
  const out: string[] = []
  for (const cand of candidates) {
    const parts = (cand as { content?: { parts?: unknown } })?.content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      const t = (part as { text?: unknown })?.text
      if (typeof t === 'string' && t.length > 0) out.push(t)
    }
  }
  return out.join('')
}

/** Lê tokens do usageMetadata (não-streaming) de forma tolerante. Só p/ registro. */
function imageUsageTokens(data: unknown): { prompt: number; completion: number; total: number } {
  const um = (data as { usageMetadata?: Record<string, unknown> })?.usageMetadata ?? {}
  const n = (v: unknown): number => {
    const x = Number(v)
    return Number.isFinite(x) && x > 0 ? x : 0
  }
  const prompt = n(um.promptTokenCount)
  const completion = n(um.candidatesTokenCount)
  const total = n(um.totalTokenCount) || prompt + completion
  return { prompt, completion, total }
}

/**
 * Caminho VERTEX IMAGEM (api_flavor 'gemini_image') — endpoint NATIVO
 * `:generateContent` (NÃO o openapi/chat/completions, que é texto).
 *
 * O desktop pede imagem via /chat/completions com modalities:['image','text'] e
 * LÊ a imagem em choices[0].delta.images[0].image_url.url. Por isso a RESPOSTA ao
 * client é SEMPRE SSE OpenAI-compatível (mesmo id/model/object do ramo texto),
 * embora o upstream aqui NÃO seja streaming (montamos o SSE a partir do JSON).
 *
 * Invariantes preservadas:
 *  - Guard de preço ANTES de gerar (image_price_usd nulo/<=0 → 400, nunca de graça).
 *  - COBRANÇA FLAT por imagem: cost = nº_imagens × image_price_usd. Débito SEMPRE
 *    que gerar (mesma mecânica: recordPendingCharge se o débito lançar).
 *  - Segurança: token/credencial nunca em log/erro/response; region só do
 *    registry; refs http(s) NÃO baixadas; erro do upstream é scrubado.
 */
async function proxyVertexImage(
  userId: string,
  model: ResolvedModel,
  body: Record<string, unknown>,
  CORS: Record<string, string>,
): Promise<Response> {
  const json = (status: number, b: unknown, extra?: Record<string, string>): Response =>
    new Response(JSON.stringify(b), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS, ...(extra ?? {}) },
    })

  // Guard de preço FLAT por imagem: recusamos ANTES de chamar o upstream se não há
  // preço de imagem configurado (nulo/<=0). Nunca gerar imagem de graça.
  const imagePrice = model.image_price_usd
  if (imagePrice == null || !(imagePrice > 0)) {
    return json(400, {
      error: { message: 'modelo de imagem sem preço configurado — indisponível', type: 'config' },
    })
  }

  // region já validada contra a allowlist no model-registry (anti-SSRF); host do
  // endpoint depende dela.
  if (!model.region) {
    return json(500, { error: { message: 'region ausente para modelo vertex', type: 'config' } })
  }

  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) {
    return json(500, { error: { message: 'GCP_PROJECT_ID ausente', type: 'config' } })
  }

  const parts = messagesToImageParts(body.messages)
  if (parts.length === 0) {
    return json(400, { error: { message: 'nenhum conteúdo de prompt para gerar imagem', type: 'bad_request' } })
  }

  // Token Google (WIF/OIDC). Falha aqui é erro de config/infra, não do client.
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    console.error('auth Google falhou (vertex image):', (e as Error).message)
    return json(500, { error: { message: 'falha de autenticação com o provedor', type: 'config' } })
  }

  const url = buildGenerateContentUrl(model.region, projectId, model.upstream_model_id, 'google')
  const genBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }

  // Chamada NÃO streaming. NÃO passamos o signal do client (débito é desacoplado).
  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(genBody),
    })
  } catch (e) {
    console.error('vertex image call falhou:', (e as Error).message)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  if (!upstream.ok) {
    // Corpo cru do upstream só server-side (pode vazar infra); ao client, scrub.
    const detail = await upstream.text().catch(() => '')
    console.error('vertex image upstream não-ok', upstream.status, detail || upstream.statusText)
    return json(upstream.status || 502, {
      error: { message: 'falha no provedor de modelo', type: 'upstream' },
    })
  }

  let data: unknown
  try {
    data = await upstream.json()
  } catch (e) {
    console.error('vertex image resposta inválida (json):', (e as Error).message)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  let images = extractInlineImages(data)
  if (images.length === 0) {
    // O desktop PRECISA da imagem; um chunk vazio não serve. Erro scrub 502.
    console.error('vertex image: modelo não retornou imagem')
    return json(502, { error: { message: 'modelo não retornou imagem', type: 'upstream' } })
  }
  // Proteção de memória do edge: imagens base64 são grandes (MBs) e a resposta do
  // upstream não tem cap. Limita a QUANTIDADE e o TAMANHO total antes de montar o
  // SSE, para não estourar o isolate (OOM).
  const MAX_IMAGES = 6
  const MAX_TOTAL_B64 = 16 * 1024 * 1024 // ~16 MB de base64 somados
  if (images.length > MAX_IMAGES) images = images.slice(0, MAX_IMAGES)
  const totalB64 = images.reduce((n, im) => n + (im.data?.length ?? 0), 0)
  if (totalB64 > MAX_TOTAL_B64) {
    console.error(`vertex image: resposta grande demais (${totalB64} b64)`)
    return json(502, { error: { message: 'imagem grande demais', type: 'upstream' } })
  }

  const text = extractText(data)
  const tokens = imageUsageTokens(data)

  // COBRANÇA FLAT: cost = nº_imagens × image_price_usd. Débito SEMPRE que gerar
  // (mesma mecânica de scrub: recordPendingCharge se o débito lançar, sem retry
  // para não arriscar cobrança dupla). Feito ANTES de responder para garantir o
  // débito; o custo não depende de tokens.
  const cost = images.length * imagePrice
  try {
    await debitUsage({
      userId,
      costUsd: cost,
      model: model.id,
      promptTokens: tokens.prompt,
      completionTokens: tokens.completion,
    })
  } catch (e) {
    console.error('debit chat (vertex image) falhou', (e as Error).message)
    await recordPendingCharge({
      userId,
      kind: 'image',
      model: model.id,
      costUsd: cost,
      reason: `debit failed (vertex image): ${(e as Error).message}`,
    })
  }

  // Resposta SSE OpenAI-compatível. UM chunk com choices[0].delta.images (uma
  // entrada por imagem, o desktop lê image_url.url) + o texto opcional; depois um
  // chunk final com finish_reason:'stop' e usage; depois [DONE].
  const id = `chatcmpl-${crypto.randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const objectType = 'chat.completion.chunk'

  const deltaImages = images.map((img) => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.data}` },
  }))

  const firstDelta: Record<string, unknown> = { role: 'assistant', images: deltaImages }
  if (text) firstDelta.content = text

  const imageChunk = {
    id,
    object: objectType,
    created,
    model: model.id,
    choices: [{ index: 0, delta: firstDelta, finish_reason: null }],
  }

  const finalChunk = {
    id,
    object: objectType,
    created,
    model: model.id,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: tokens.prompt,
      completion_tokens: tokens.completion,
      total_tokens: tokens.total,
    },
  }

  const sse =
    `data: ${JSON.stringify(imageChunk)}\n\n` +
    `data: ${JSON.stringify(finalChunk)}\n\n` +
    `data: [DONE]\n\n`

  return new Response(sse, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...CORS,
    },
  })
}

/**
 * Caminho VERTEX (FASE 1: Gemini/Google via Vertex, flavor OpenAI).
 *
 * Preserva TODAS as invariantes do proxy: dreno do SSE DESACOPLADO do client
 * (o pump em background segue lendo o upstream até o fim mesmo se o client
 * abortar) e DÉBITO SEMPRE (fallback MIN_CHARGE_USD; recordPendingCharge se o
 * débito lançar). A resposta ao client é SEMPRE formato OpenAI/SSE — o endpoint
 * openapi do Vertex já devolve nesse formato, então repassamos os chunks crus.
 *
 * Diferenças em relação ao caminho OpenRouter:
 *  - Auth via Google WIF (getAccessToken) em vez da OPENROUTER_KEY.
 *  - NÃO existe `usage.cost` na resposta: o custo é calculado por nós a partir
 *    dos tokens (usage do chunk final) × preços da tabela `public.models`.
 *  - Guard de preço 0: recusa ANTES de gerar (evita geração "de graça").
 */
async function proxyVertex(
  userId: string,
  model: ResolvedModel,
  body: Record<string, unknown>,
  CORS: Record<string, string>,
): Promise<Response> {
  const json = (status: number, b: unknown, extra?: Record<string, string>): Response =>
    new Response(JSON.stringify(b), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS, ...(extra ?? {}) },
    })

  // Guard de preço: recusamos ANTES de chamar o upstream se o preço de SAÍDA
  // (output_price) for <= 0. Decisão: a saída é o que o modelo GERA; se ela for
  // gratuita, a geração sai de graça independentemente do preço de entrada — o
  // que abriria um buraco de cobrança. Por isso barramos por output_price <= 0
  // (não apenas quando AMBOS são 0): nunca gerar saída sem preço configurado.
  if (model.output_price_usd_per_mtok <= 0) {
    return json(400, {
      error: { message: 'modelo sem preço de saída configurado — indisponível', type: 'config' },
    })
  }
  // region já foi validada contra a allowlist no model-registry (anti-SSRF); aqui
  // só garantimos que não é nula (o host do endpoint depende dela).
  if (!model.region) {
    return json(500, { error: { message: 'region ausente para modelo vertex', type: 'config' } })
  }

  // Token Google (WIF/OIDC). Falha aqui é erro de config/infra, não do client.
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    // Detalhe cru só server-side; ao client, mensagem genérica (sem vazar infra).
    console.error('auth Google falhou (vertex):', (e as Error).message)
    return json(500, { error: { message: 'falha de autenticação com o provedor', type: 'config' } })
  }

  // Chamada streaming ao Vertex. NÃO passamos o signal do client: o dreno é
  // desacoplado (débito sempre). callVertex reescreve o corpo (model=upstream,
  // stream=true, stream_options.include_usage=true, remove usage.include).
  let upstream: Response
  try {
    upstream = await callVertex({
      region: model.region,
      upstreamModelId: model.upstream_model_id,
      body,
      accessToken,
    })
  } catch (e) {
    // Detalhe cru só server-side; ao client, mensagem genérica (sem vazar infra).
    console.error('vertex call falhou:', (e as Error).message)
    return json(502, { error: { message: 'falha no provedor de modelo', type: 'upstream' } })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    // Corpo cru do upstream só server-side; preservamos o status HTTP e devolvemos
    // ao client uma mensagem genérica (o corpo cru pode vazar detalhes de infra).
    console.error('vertex upstream não-ok', upstream.status, detail || upstream.statusText)
    return json(upstream.status || 502, {
      error: { message: 'falha no provedor de modelo', type: 'upstream' },
    })
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastUsage: VertexUsage | null = null

  // Processa UMA linha SSE (mesmo trim do ramo OpenRouter, para uniformizar o
  // parsing entre os dois caminhos).
  const scanLine = (raw: string): void => {
    const line = raw.trim()
    if (!line.startsWith('data:')) return
    const u = usageFromDataPayload(line.slice('data:'.length))
    if (u) lastUsage = u
  }

  const scan = (text: string): void => {
    buffer += text
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      scanLine(line)
    }
  }

  // Flush do resíduo: um último `data:` com usage pode chegar sem '\n' final. Sem
  // este scan, esse usage se perderia e cairíamos em MIN_CHARGE. Chamado após o
  // loop de leitura terminar (done) e ANTES do settle/débito.
  const flush = (): void => {
    if (buffer.length === 0) return
    scanLine(buffer)
    buffer = ''
  }

  const settle = async (): Promise<void> => {
    const usage = lastUsage
    try {
      if (usage) {
        // cost_usd = in/1e6*input_price + out/1e6*output_price. Como já barramos
        // preço 0 acima, costUsd não lança PriceNotConfiguredError aqui.
        const cost = costUsd({
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          inputPrice: model.input_price_usd_per_mtok,
          outputPrice: model.output_price_usd_per_mtok,
        })
        await debitUsage({
          userId,
          costUsd: cost,
          model: model.id, // model canônico da tabela (id OpenRouter p/ dedup).
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        })
      } else {
        // Sem usage no SSE: cobra o mínimo para que toda geração debite.
        await debitUsage({ userId, costUsd: MIN_CHARGE_USD, model: model.id })
      }
    } catch (e) {
      // Débito lançou: não sabemos se aplicou → NÃO retenta (evita dupla
      // cobrança). Marca para reconciliação.
      console.error('debit chat (vertex) falhou', (e as Error).message)
      await recordPendingCharge({
        userId,
        kind: 'chat',
        model: model.id,
        costUsd: null,
        reason: `debit failed (vertex): ${(e as Error).message}`,
      })
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let clientGone = false
      ;(async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            scan(decoder.decode(value, { stream: true }))
            if (!clientGone) {
              try {
                controller.enqueue(value)
              } catch {
                // Client desconectou: paramos de enfileirar, mas SEGUIMOS lendo o
                // upstream até o fim para capturar o usage e debitar.
                clientGone = true
              }
            }
          }
        } catch (e) {
          console.error('drain vertex falhou', (e as Error).message)
        } finally {
          // Loop terminou (done) — captura um último `data:`/usage residual que
          // tenha chegado sem '\n' final, ANTES de liquidar o débito.
          flush()
          await settle()
          try {
            controller.close()
          } catch {
            /* já fechado (client foi embora) */
          }
        }
      })()
    },
    cancel() {
      // Client cancelou. NÃO cancelamos o upstream — o pump segue drenando até o
      // fim para garantir o débito.
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...CORS,
    },
  })
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
  const rl = await checkRateLimit({ userId, bucket: 'chat', limit: RATE_LIMIT, windowSeconds: RATE_WINDOW_S })
  if (!rl.allowed) {
    const retry = rl.resetAt ? Math.max(1, Math.ceil((Date.parse(rl.resetAt) - Date.now()) / 1000)) : RATE_WINDOW_S
    return json(
      429,
      { error: { message: 'muitas requisições — aguarde e tente de novo', type: 'rate_limited' } },
      { 'Retry-After': String(retry) },
    )
  }

  // 3) Gate de saldo — protege a chave antes de qualquer chamada à OpenRouter.
  try {
    const balance = await getBalance(userId)
    if (!(balance > 0)) {
      return json(402, { error: { message: 'créditos esgotados', type: 'insufficient_credits' } })
    }
  } catch (e) {
    return json(502, { error: { message: `falha ao checar saldo: ${(e as Error).message}`, type: 'upstream' } })
  }

  // 3b) Cap de gasto diário (§7) — DESABILITADO por padrão. Só ativo quando
  // DAILY_SPEND_CAP_USD > 0. Soma o gasto USD do dia (usage_log) e barra com 402
  // se já atingiu/excedeu o teto. FAIL-OPEN: erro de infra não bloqueia (a soma
  // já devolve 0 nesse caso), pois é uma feature opcional.
  if (Number.isFinite(DAILY_SPEND_CAP_USD) && DAILY_SPEND_CAP_USD > 0) {
    try {
      const spentTodayUsd = await getSpendTodayUsd(userId)
      if (spentTodayUsd >= DAILY_SPEND_CAP_USD) {
        return json(402, { error: { message: 'limite de gasto diário atingido', type: 'daily_cap' } })
      }
    } catch (e) {
      console.error('daily cap check falhou (fail-open):', (e as Error).message)
    }
  }

  // 4) Corpo: cap de tamanho + validação zod + allow-list de modelo.
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: { message: 'corpo grande demais', type: 'bad_request' } })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json(400, { error: { message: 'corpo inválido', type: 'bad_request' } })
  }
  const result = BodySchema.safeParse(parsed)
  if (!result.success) {
    return json(400, { error: { message: 'parâmetros inválidos', type: 'bad_request' } })
  }
  const body = result.data as Record<string, unknown>
  const model = body.model as string

  const allow = modelAllowList()
  if (allow && !allow.has(model)) {
    return json(400, { error: { message: 'modelo não permitido', type: 'bad_request' } })
  }

  // 4b) RESOLUÇÃO OVERLAY: a tabela public.models é a fonte de verdade de
  // roteamento. Achou E provider==='vertex' && api_flavor==='openai' → caminho
  // VERTEX. Senão (não achou, ou outro provider/flavor) → FALLBACK OpenRouter
  // (o caminho ATUAL, 100% intacto, logo abaixo). A tabela é overlay, não a
  // allow-list única: o que não estiver nela (incl. Claude na Fase 1) vai pra
  // OpenRouter, que valida os próprios modelos.
  let resolved: ResolvedModel | null = null
  try {
    resolved = await resolveModel(model)
  } catch (e) {
    if (e instanceof RegionNotAllowedError) {
      // Recusa de segurança (anti-SSRF), não um "não encontrado".
      return json(400, { error: { message: 'região do modelo não permitida', type: 'bad_request' } })
    }
    return json(502, { error: { message: `falha ao resolver modelo: ${(e as Error).message}`, type: 'upstream' } })
  }

  if (resolved && resolved.provider === 'vertex' && resolved.api_flavor === 'gemini_image') {
    return proxyVertexImage(userId, resolved, body, CORS)
  }

  if (resolved && resolved.provider === 'vertex' && resolved.api_flavor === 'openai') {
    return proxyVertex(userId, resolved, body, CORS)
  }

  // Força streaming + pede o custo (usage.include) à OpenRouter.
  body.stream = true
  body.usage = { include: true }

  // 5) Encaminha à OpenRouter com a chave real (só existe aqui).
  const key = process.env.OPENROUTER_KEY
  if (!key) return json(500, { error: { message: 'OPENROUTER_KEY ausente', type: 'config' } })

  const upstream = await fetch(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://axyoma-ai.app',
      'X-Title': 'AXYOMA AI',
    },
    body: JSON.stringify(body),
  })

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    // Corpo cru do upstream só server-side; preservamos o status HTTP e devolvemos
    // ao client uma mensagem genérica (o corpo cru pode vazar detalhes de infra).
    console.error('openrouter upstream não-ok', upstream.status, detail || upstream.statusText)
    return json(upstream.status || 502, {
      error: { message: 'falha no provedor de modelo', type: 'upstream' },
    })
  }

  // 6) Dreno do SSE DESACOPLADO do client. Um pump em background lê o upstream
  // até o fim (mesmo que o client desconecte), enquanto tenta repassar cada chunk
  // ao client. Ao terminar, debita — SEMPRE.
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastUsage: Usage | null = null

  const scan = (text: string): void => {
    buffer += text
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const obj = JSON.parse(payload)
        if (obj && obj.usage) lastUsage = obj.usage as Usage
      } catch {
        /* chunk parcial/keepalive — ignora */
      }
    }
  }

  const settle = async (): Promise<void> => {
    try {
      if (lastUsage && typeof lastUsage.cost === 'number' && lastUsage.cost >= 0) {
        await debitUsage({
          userId,
          costUsd: lastUsage.cost,
          model,
          promptTokens: lastUsage.prompt_tokens,
          completionTokens: lastUsage.completion_tokens,
        })
      } else {
        // Sem usage.cost: cobra o mínimo para que toda geração debite.
        await debitUsage({ userId, costUsd: MIN_CHARGE_USD, model })
      }
    } catch (e) {
      // Débito lançou: não sabemos se aplicou → NÃO retenta (evita dupla
      // cobrança). Marca para reconciliação.
      console.error('debit chat falhou', (e as Error).message)
      await recordPendingCharge({
        userId,
        kind: 'chat',
        model,
        costUsd: lastUsage?.cost ?? null,
        reason: `debit failed: ${(e as Error).message}`,
      })
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let clientGone = false
      ;(async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            scan(decoder.decode(value, { stream: true }))
            if (!clientGone) {
              try {
                controller.enqueue(value)
              } catch {
                // Client desconectou: paramos de enfileirar, mas SEGUIMOS lendo o
                // upstream até o fim para capturar o usage e debitar.
                clientGone = true
              }
            }
          }
        } catch (e) {
          console.error('drain upstream falhou', (e as Error).message)
        } finally {
          await settle()
          try {
            controller.close()
          } catch {
            /* já fechado (client foi embora) */
          }
        }
      })()
    },
    cancel() {
      // Client cancelou o stream. NÃO cancelamos o upstream — o pump continua
      // drenando até o fim para garantir o débito. (enqueue passará a lançar,
      // tratado no loop acima.)
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...CORS,
    },
  })
}
