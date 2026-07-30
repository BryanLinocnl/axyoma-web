import { verifyUserWithEmail } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { getAdminErrorGroups, setErrorTriage } from '@/lib/supabase-admin'

// Erros do agente, AGRUPADOS, e a triagem do quadro.
//
// GET  → grupos, com o estado de triagem já embutido (uma consulta, não duas).
// POST → move um card: `{ fingerprint, status, fixed_in_version?, nota? }`.
//
// O gate é o mesmo das demais rotas de admin: e-mail na allowlist da env. As
// RPCs checam o papel por conta própria — defesa em profundidade, para uma rota
// nova que esqueça a conferência não passar a vazar dados de todos os usuários.
export const runtime = 'edge'

async function autorizar(req: Request): Promise<{ userId: string } | Response> {
  let email: string | null
  let userId: string
  try {
    ;({ email, userId } = await verifyUserWithEmail(req.headers.get('authorization')))
  } catch {
    return Response.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!isAdminEmail(email)) return Response.json({ error: 'acesso negado' }, { status: 403 })
  return { userId }
}

export async function GET(req: Request): Promise<Response> {
  const auth = await autorizar(req)
  if (auth instanceof Response) return auth

  const q = new URL(req.url).searchParams
  const bucketBruto = q.get('bucket')
  // `todos` (bucket nulo) existe para investigar; o padrão é `bug`, porque erro
  // de ambiente do usuário não pode competir com defeito nosso na lista.
  const bucket = bucketBruto === 'ambiente' ? 'ambiente' : bucketBruto === 'todos' ? null : 'bug'
  const dias = Number(q.get('dias') ?? 30)
  const porVariacao = q.get('variacao') === '1'

  try {
    const grupos = await getAdminErrorGroups({
      userId: auth.userId,
      bucket,
      dias: Number.isFinite(dias) ? dias : 30,
      porVariacao,
    })
    return Response.json({ grupos })
  } catch (err) {
    console.error('admin errors falhou:', (err as Error).message)
    return Response.json({ error: 'falha ao carregar erros' }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await autorizar(req)
  if (auth instanceof Response) return auth

  let body: { fingerprint?: string; status?: string; fixed_in_version?: string; nota?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'corpo inválido' }, { status: 400 })
  }
  if (!body.fingerprint || !body.status) {
    return Response.json({ error: 'fingerprint e status são obrigatórios' }, { status: 400 })
  }

  try {
    await setErrorTriage({
      userId: auth.userId,
      fingerprint: body.fingerprint,
      status: body.status,
      fixedInVersion: body.fixed_in_version ?? null,
      nota: body.nota ?? null,
    })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('admin triage falhou:', (err as Error).message)
    return Response.json({ error: 'falha ao atualizar' }, { status: 500 })
  }
}
