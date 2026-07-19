import { verifyUser } from '@/lib/auth'
import { getBillingConfig } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

// Config de preço NÃO-sensível (billing_config): credit_brl, usd_brl_rate,
// margin_multiplier, rate_updated_at. JWT-gated como as rotas /api/v1/*.
// Nunca devolve product ids / segredos — só o necessário pra converter R$.
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

  try {
    const cfg = await getBillingConfig()
    return new Response(JSON.stringify(cfg), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
    })
  } catch {
    return new Response(JSON.stringify({ error: { message: 'config indisponível' } }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
}
