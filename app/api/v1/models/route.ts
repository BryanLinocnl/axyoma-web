import { corsHeaders } from '@/lib/cors'

// Catálogo de modelos — pass-through do catálogo PÚBLICO da OpenRouter (a rota
// /models não exige chave). NÃO exige login: a lista de modelos é dado público;
// o que precisa de auth é a SELEÇÃO do usuário (tabela model_selection, sob RLS),
// feita separadamente no cliente. Proxiamos aqui só para evitar CORS do browser
// e manter a origem única (e a OPENROUTER_KEY nunca chega ao cliente).
export const runtime = 'edge'

const OPENROUTER = 'https://openrouter.ai/api/v1'

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'GET, OPTIONS') })
}

export async function GET(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'GET, OPTIONS')
  const key = process.env.OPENROUTER_KEY
  const upstream = await fetch(`${OPENROUTER}/models`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
  })
}
