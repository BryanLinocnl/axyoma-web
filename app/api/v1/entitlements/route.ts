import { verifyUserWithEmail } from '@/lib/auth'
import { getEntitlements } from '@/lib/supabase-admin'
import { checkRateLimit } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'
import { sincronizarPapel } from '@/lib/admin'

// Recursos efetivos do usuário: "o que ele PODE usar", em vez de "ele é Pro?".
//
// A pergunta antiga espalhava a regra pelo código — cada recurso novo virava um
// `plan === 'solo'` a mais, em outro arquivo, e mudar o que um plano entrega
// exigia release do desktop. Aqui a regra é dado (`plans.features`) e a resposta
// é um objeto só.
//
// A resolução acontece no SERVIDOR de propósito. A RLS até permitiria o cliente
// ler `plans` direto, mas isso devolveria as features de TODOS os planos e
// deixaria a resolução da assinatura ativa no cliente — que é exatamente onde
// ela não pode morar.
export const runtime = 'edge'

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'GET, OPTIONS') })
}

export async function GET(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'GET, OPTIONS')
  const json = (status: number, body: unknown, extra?: Record<string, string>): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS, ...(extra ?? {}) },
    })

  let userId: string
  // E-mail junto: o gate de developer (`ADMIN_EMAILS`) compara por e-mail, e
  // `verifyUserWithEmail` só devolve o claim quando ele é VERIFICADO — sem isso,
  // bastaria cadastrar-se com o e-mail de um admin para herdar as features dele.
  let email: string | null = null
  try {
    const v = await verifyUserWithEmail(req.headers.get('authorization'))
    userId = v.userId
    email = v.email
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // Limite folgado: o app consulta no login e a resposta é cacheada no cliente.
  // `failOpen` porque esta rota não gasta dinheiro nosso — e negar por
  // instabilidade de rate limit rebaixaria um assinante a Free.
  const rl = await checkRateLimit({
    userId,
    bucket: 'entitlements',
    limit: Number(process.env.ENTITLEMENTS_RATE_LIMIT ?? 60),
    windowSeconds: 60,
    failOpen: true,
  })
  if (!rl.allowed) return json(429, { error: { message: 'muitas consultas', type: 'rate_limit' } })

  // Espelha `profiles.role` a partir de ADMIN_EMAILS — AQUI, e não só em
  // /api/admin/status.
  //
  // Aquela rota é do SITE (mostra/esconde o item "Dev" na sidebar). O aplicativo
  // desktop nunca a chama: no login ele chama esta, `/credits/bootstrap` e o
  // catálogo. Resultado, até 03/08: o bypass de cobrança de developer existia no
  // SQL (`hold_credits` e `settle_hold` checam `is_developer`) e era inalcançável
  // para quem só usa o app — `profiles.role` ficava em 'user' para sempre, porque
  // ninguém nunca escrevia o espelho. Um usuário concedido na env batia em "402
  // créditos esgotados" como qualquer outro.
  //
  // Esta rota é o lugar certo pelo mesmo motivo que a outra era: já roda uma vez
  // por login, já tem o e-mail VERIFICADO em mãos, e não custa chamada extra.
  // Sem `await`: o espelho serve ao SQL depois, e segurar a resposta do login por
  // causa dele seria pagar latência por um efeito que ninguém espera aqui.
  const supaUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supaUrl && serviceRole && userId) void sincronizarPapel(userId, email, supaUrl, serviceRole)

  // `getEntitlements` já degrada para Free em qualquer falha, então não há ramo
  // de erro aqui: a rota sempre responde 200 com um objeto completo. Um 5xx
  // deixaria o cliente sem resposta e o obrigaria a decidir sozinho o que
  // liberar — decisão que não é dele.
  const ent = await getEntitlements(userId, email)
  return json(200, ent, { 'Cache-Control': 'private, max-age=60' })
}
