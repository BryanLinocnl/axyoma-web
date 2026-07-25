import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

// Busca web (Tavily) para o agente do desktop.
//
// SEGURANÇA: a chave da Tavily fica AQUI, no servidor. Antes ela era embutida no
// binário via MAIN_VITE_TAVILY_KEY — e `MAIN_VITE_*` é inlinado pelo Vite dentro
// do app.asar, que não é criptografado: qualquer um extraía a chave e gastava na
// conta do app. O desktop agora chama esta rota com o JWT da sessão.
//
// O usuário que preferir usar a PRÓPRIA chave continua chamando a Tavily direto
// do app (a chave dele nunca sai da máquina).

export const runtime = 'edge'

const BodySchema = z.object({
  query: z.string().trim().min(1).max(500),
  max_results: z.number().int().min(1).max(10).optional(),
})

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
}

export async function POST(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'POST, OPTIONS')
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  // 1. Autenticação — sem sessão válida, sem busca (a chave é nossa).
  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // 2. Rate limit por usuário — fail-CLOSED: se o limitador não responde, a
  // requisição é recusada (a chave é um custo nosso; melhor negar que vazar uso).
  try {
    const rl = await checkRateLimit({
      userId,
      bucket: 'search',
      limit: Number(process.env.SEARCH_RATE_LIMIT ?? 60),
      windowSeconds: 60,
    })
    if (!rl.allowed) {
      return json(429, { error: { message: 'muitas buscas — tente em instantes', type: 'rate_limit' } })
    }
  } catch {
    return json(429, { error: { message: 'limite indisponível — tente novamente', type: 'rate_limit' } })
  }

  // 3. Corpo validado (nada de repassar campos arbitrários pra Tavily).
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return json(400, { error: { message: 'corpo inválido', type: 'invalid_request' } })
  }

  const key = process.env.TAVILY_API_KEY
  if (!key) return json(502, { error: { message: 'busca indisponível', type: 'config' } })

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: body.query,
        max_results: body.max_results ?? 6,
        include_answer: true,
        include_images: true,
        search_depth: 'basic',
      }),
    })
    if (!res.ok) {
      // Nunca repassa o corpo do upstream (pode conter eco da chave/detalhes).
      console.error('tavily não-ok', res.status)
      return json(502, { error: { message: 'busca indisponível', type: 'upstream' } })
    }
    const data = (await res.json()) as {
      answer?: string
      results?: { title: string; url: string; content: string }[]
      images?: (string | { url: string })[]
    }
    // Projeção explícita: só o que o agente precisa sai daqui.
    return json(200, {
      answer: data.answer,
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        content: (r.content ?? '').slice(0, 400),
      })),
      images: (data.images ?? []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean),
    })
  } catch (e) {
    console.error('tavily falhou:', (e as Error).message)
    return json(502, { error: { message: 'busca indisponível', type: 'upstream' } })
  }
}
