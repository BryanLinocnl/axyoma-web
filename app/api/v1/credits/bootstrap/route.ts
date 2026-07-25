import { verifyUser } from '@/lib/auth'
import { checkRateLimit, grantSignupBonus } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

// Bônus de cadastro (crédito grátis do primeiro acesso).
//
// POR QUE UMA ROTA: o valor mora no ENV daqui (`SIGNUP_BONUS_CREDITS`), e nem o
// trigger do Postgres nem o cliente enxergam isso. O cadastro em si não passa
// por rota nossa — web e desktop chamam `supabase.auth.signUp` direto —, então
// a concessão acontece no primeiro carregamento autenticado, que é quando o app
// bate aqui.
//
// SEGURANÇA:
//  • o corpo da requisição é IGNORADO — quem escolhe o valor é o env, nunca o
//    cliente (um `{"credits": 999999}` não teria efeito nenhum);
//  • a idempotência é do banco: `grant_signup_bonus` só credita se
//    `signup_bonus_granted_at is null`, e o UPDATE condicional serializa dois
//    logins simultâneos;
//  • rate limit fail-closed, como toda rota que mexe em dinheiro.
//
// Para mudar o valor: variável na Vercel + redeploy. Sem SQL, sem migration.

export const runtime = 'edge'

const DEFAULT_BONUS = 1000
// Teto de sanidade: protege contra um typo na env (ex.: 1000000) virar prejuízo
// silencioso multiplicado por cada cadastro novo.
const MAX_BONUS = 100_000

function bonusCredits(): number {
  const raw = process.env.SIGNUP_BONUS_CREDITS
  if (raw == null || raw.trim() === '') return DEFAULT_BONUS
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    console.error(`SIGNUP_BONUS_CREDITS inválido (${raw}) — usando ${DEFAULT_BONUS}`)
    return DEFAULT_BONUS
  }
  if (n > MAX_BONUS) {
    console.error(`SIGNUP_BONUS_CREDITS acima do teto (${n} > ${MAX_BONUS}) — limitando`)
    return MAX_BONUS
  }
  return n
}

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

  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // Chamada a cada login/refresh do app: o limite existe só para evitar loop de
  // cliente batendo sem parar (a concessão em si já é uma vez só, no banco).
  try {
    const rl = await checkRateLimit({
      userId,
      bucket: 'credits_bootstrap',
      limit: Number(process.env.CREDITS_BOOTSTRAP_RATE_LIMIT ?? 30),
      windowSeconds: 60,
    })
    if (!rl.allowed) {
      return json(429, { error: { message: 'muitas tentativas — tente em instantes', type: 'rate_limit' } })
    }
  } catch {
    return json(503, { error: { message: 'serviço indisponível', type: 'rate_limit' } })
  }

  try {
    const balance = await grantSignupBonus(userId, bonusCredits())
    return json(200, { balance })
  } catch (e) {
    // Nunca quebra o login: o app segue lendo o saldo direto do Supabase e
    // tenta de novo no próximo carregamento.
    console.error('grant_signup_bonus falhou:', (e as Error).message)
    return json(502, { error: { message: 'não foi possível verificar o bônus', type: 'upstream' } })
  }
}
