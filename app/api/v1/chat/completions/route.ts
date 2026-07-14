import { verifyUser } from '@/lib/auth'
import { getBalance, debitUsage } from '@/lib/supabase-admin'

// Proxy de chat completions (OpenAI-compatible), streaming pass-through.
// Fluxo: verifica JWT → checa saldo → injeta a chave real → repassa o SSE da
// OpenRouter ao app, lendo o `usage.cost` do chunk final para debitar no fim.
export const runtime = 'edge'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

interface Usage {
  cost?: number
  prompt_tokens?: number
  completion_tokens?: number
}

export async function POST(req: Request): Promise<Response> {
  // 1) Autenticação (local, sem tocar o Supabase).
  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // 2) Gate de saldo — protege a chave antes de qualquer chamada à OpenRouter.
  try {
    const balance = await getBalance(userId)
    if (!(balance > 0)) {
      return json(402, { error: { message: 'créditos esgotados', type: 'insufficient_credits' } })
    }
  } catch (e) {
    return json(502, { error: { message: `falha ao checar saldo: ${(e as Error).message}`, type: 'upstream' } })
  }

  // 3) Corpo: força streaming + pede o custo (usage.include) à OpenRouter.
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: { message: 'corpo inválido', type: 'bad_request' } })
  }
  body.stream = true
  body.usage = { include: true }
  const model = typeof body.model === 'string' ? body.model : null

  // 4) Encaminha à OpenRouter com a chave real (só existe aqui).
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

  // 5) Tee do SSE: repassa cada chunk ao app e vai lendo o último `usage` visto.
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

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        // Débito no fim do stream (mesma invocação). Falha aqui não quebra a
        // resposta já entregue — apenas loga; reconciliação via usage_log.
        try {
          if (lastUsage && typeof lastUsage.cost === 'number' && lastUsage.cost >= 0) {
            await debitUsage({
              userId,
              costUsd: lastUsage.cost,
              model,
              promptTokens: lastUsage.prompt_tokens,
              completionTokens: lastUsage.completion_tokens,
            })
          }
        } catch (e) {
          console.error('debit falhou', (e as Error).message)
        }
        controller.close()
        return
      }
      controller.enqueue(value)
      scan(decoder.decode(value, { stream: true }))
    },
    cancel() {
      reader.cancel().catch(() => {})
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
