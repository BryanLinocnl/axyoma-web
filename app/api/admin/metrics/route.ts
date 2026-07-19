import { verifyUserWithEmail } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { getAdminMetrics } from '@/lib/supabase-admin'

export const runtime = 'edge'

export async function GET(req: Request): Promise<Response> {
  let email: string | null
  try {
    ;({ email } = await verifyUserWithEmail(req.headers.get('authorization')))
  } catch {
    return Response.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!isAdminEmail(email)) {
    return Response.json({ error: 'acesso negado' }, { status: 403 })
  }
  try {
    const metrics = await getAdminMetrics()
    return Response.json(metrics)
  } catch (err) {
    // Não vaza detalhe interno (mensagens de RPC/PostgREST) ao client; loga no
    // servidor e devolve mensagem genérica.
    console.error('admin metrics falhou:', (err as Error).message)
    return Response.json({ error: 'falha ao carregar métricas' }, { status: 500 })
  }
}
