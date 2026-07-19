import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import { getBalance, debitUsage, checkRateLimit, recordPendingCharge } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

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
const MAX_BODY_BYTES = Number(process.env.CHAT_MAX_BODY_BYTES ?? 256 * 1024) // 256 KB
const MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS ?? 32000)
const MAX_MESSAGES = 200
const MIN_CHARGE_USD = Number(process.env.CHAT_MIN_CHARGE_USD ?? 0.0002)

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
    return json(upstream.status || 502, {
      error: { message: `openrouter: ${detail || upstream.statusText}`, type: 'upstream' },
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
