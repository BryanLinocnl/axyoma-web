import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import { getBalance, debitUsage, checkRateLimit, recordPendingCharge } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

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

  // 4) Config server-only.
  const key = process.env.OPENROUTER_KEY
  if (!key) return json(500, { error: { message: 'OPENROUTER_KEY ausente', type: 'config' } })
  const supaUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceRole) {
    return json(500, { error: { message: 'SUPABASE_URL/SERVICE_ROLE_KEY ausentes', type: 'config' } })
  }

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
  if (!up.ok) {
    const detail = await up.text().catch(() => '')
    return json(502, { error: { message: `storage upload falhou: ${detail || up.statusText}`, type: 'upstream' } })
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
  let saved: Record<string, unknown> = row
  if (ins.ok) {
    const rows = (await ins.json().catch(() => [])) as Record<string, unknown>[]
    if (rows[0]) saved = rows[0]
  } else {
    console.error('insert image_generations falhou', await ins.text().catch(() => ''))
  }

  // 9) URL assinada para exibição imediata (bucket privado).
  let signedUrl: string | null = null
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
    if (s?.signedURL) signedUrl = `${supaUrl}/storage/v1${s.signedURL}`
  }

  return json(200, { image: saved, path: objectPath, signedUrl, credits: creditsCharged })
}
