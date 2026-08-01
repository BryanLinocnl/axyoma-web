import { verifyUserWithEmail } from '@/lib/auth'
import { getEntitlements } from '@/lib/supabase-admin'
import { checkRateLimit } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

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

  // `getEntitlements` já degrada para Free em qualquer falha, então não há ramo
  // de erro aqui: a rota sempre responde 200 com um objeto completo. Um 5xx
  // deixaria o cliente sem resposta e o obrigaria a decidir sozinho o que
  // liberar — decisão que não é dele.
  const ent = await getEntitlements(userId, email)
  return json(200, ent, { 'Cache-Control': 'private, max-age=60' })
}
