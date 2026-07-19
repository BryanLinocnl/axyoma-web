import { verifyUser } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

// Feed de notícias de modelos (P3B). Leitura JWT-gated: devolve as linhas mais
// recentes de `model_news`. A tabela é WRITE-only-por-service-role (o agregador
// vive em ./refresh); aqui só LEMOS. Preferimos ler via service-role no servidor
// (rota mais limpa e cacheável) a expor a leitura direta ao browser — embora a
// RLS também permita SELECT a `authenticated`.
export const runtime = 'edge'

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'GET, OPTIONS') })
}

export async function GET(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'GET, OPTIONS')
  try {
    await verifyUser(req.headers.get('authorization'))
  } catch {
    return new Response(JSON.stringify({ error: { message: 'não autenticado' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return new Response(JSON.stringify({ error: { message: 'config indisponível' } }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/model_news?select=id,source,title,url,summary,image_url,published_at,created_at` +
        `&order=published_at.desc.nullslast,created_at.desc&limit=60`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) throw new Error(`model_news ${res.status}`)
    const rows = await res.json()
    return new Response(JSON.stringify({ items: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
    })
  } catch {
    return new Response(JSON.stringify({ error: { message: 'feed indisponível' } }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
}
