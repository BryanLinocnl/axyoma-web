import { verifyUser } from '@/lib/auth'

// Catálogo de modelos — pass-through do catálogo da OpenRouter. Exige JWT válido
// para não deixar o proxy aberto. O app passa a listar modelos por aqui em vez
// de bater direto em openrouter.ai.
export const runtime = 'edge'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const CORS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(req: Request): Promise<Response> {
  try {
    await verifyUser(req.headers.get('authorization'))
  } catch {
    return new Response(JSON.stringify({ error: { message: 'não autenticado' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const key = process.env.OPENROUTER_KEY
  const upstream = await fetch(`${OPENROUTER}/models`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
  })
}
