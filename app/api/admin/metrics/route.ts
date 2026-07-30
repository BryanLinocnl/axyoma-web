import { verifyUserWithEmail } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { getAdminMetrics, getAdminSeries } from '@/lib/supabase-admin'

export const runtime = 'edge'

export async function GET(req: Request): Promise<Response> {
  let email: string | null
  let userId: string
  try {
    ;({ email, userId } = await verifyUserWithEmail(req.headers.get('authorization')))
  } catch {
    return Response.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!isAdminEmail(email)) {
    return Response.json({ error: 'acesso negado' }, { status: 403 })
  }

  const dias = Number(new URL(req.url).searchParams.get('dias') ?? 30)

  try {
    // Em paralelo: são consultas independentes, e serializá-las dobraria o tempo
    // de abertura do painel sem motivo.
    const [metrics, serie] = await Promise.all([
      getAdminMetrics(userId),
      getAdminSeries(userId, Number.isFinite(dias) ? dias : 30),
    ])
    return Response.json({ metrics, serie })
  } catch (err) {
    // A mensagem genérica ao cliente é deliberada (não vaza detalhe de RPC), mas
    // o log do servidor precisa do detalhe: foi essa opacidade que escondeu o
    // fato de a RPC `admin_metrics_summary` sequer existir no banco.
    console.error('admin metrics falhou:', (err as Error).message)
    return Response.json({ error: 'falha ao carregar métricas' }, { status: 500 })
  }
}
