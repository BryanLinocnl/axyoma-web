import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from 'jose'

// Verificação de JWT do Supabase. Suporta os três cenários possíveis do projeto:
//  1. Assinatura ASSIMÉTRICA (ES256/RS256): valida local via JWKS público.
//  2. Assinatura HS256 (legado): valida local com SUPABASE_JWT_SECRET.
//  3. Fallback universal: se a validação local falhar (ou faltar segredo/URL),
//     valida chamando o GoTrue do Supabase (`/auth/v1/user`). Um round-trip, mas
//     funciona independentemente do modo de assinatura — evita 401 espúrio quando
//     o modo local não bate com o token.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let jwks: JWTVerifyGetKey | null = null
function getJwks(): JWTVerifyGetKey {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL ausente')
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  }
  return jwks
}

type Claims = { sub?: string; email?: string; [k: string]: unknown }

/** Valida localmente (JWKS e/ou HS256). Lança se nenhum caminho local validar. */
async function verifyLocal(token: string): Promise<Claims> {
  const errors: unknown[] = []
  // 1. HS256 com segredo, se configurado.
  if (JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET))
      return payload as Claims
    } catch (e) {
      errors.push(e)
    }
  }
  // 2. Assimétrico via JWKS.
  if (SUPABASE_URL) {
    try {
      const { payload } = await jwtVerify(token, getJwks())
      return payload as Claims
    } catch (e) {
      errors.push(e)
    }
  }
  throw new Error(`validação local falhou (${errors.length} tentativas)`)
}

/** Fallback: pergunta ao GoTrue quem é o dono do token. Só usado se o local falhar. */
async function verifyViaGoTrue(token: string): Promise<Claims> {
  if (!SUPABASE_URL || !ANON_KEY) throw new Error('SUPABASE_URL/ANON_KEY ausentes para fallback')
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('token inválido (gotrue)')
  const user = (await res.json()) as { id?: string; email?: string }
  if (!user.id) throw new Error('gotrue sem id')
  return { sub: user.id, email: user.email }
}

async function verifyRawToken(token: string): Promise<Claims> {
  try {
    return await verifyLocal(token)
  } catch {
    return await verifyViaGoTrue(token)
  }
}

async function verify(authHeader: string | null): Promise<Claims> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('authorization ausente')
  }
  return verifyRawToken(authHeader.slice(7).trim())
}

/**
 * Verifica um access token vindo de um cookie (usado pelo middleware server-side).
 * Retorna `{ userId, email }`; lança se inválido/expirado.
 */
export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string | null }> {
  const payload = await verifyRawToken(token)
  const sub = payload.sub
  if (!sub || typeof sub !== 'string') throw new Error('sub ausente')
  const email = typeof payload.email === 'string' ? payload.email : null
  return { userId: sub, email }
}

/** Retorna o user id (claim `sub`) se o token for válido; lança se inválido/expirado. */
export async function verifyUser(authHeader: string | null): Promise<string> {
  const payload = await verify(authHeader)
  const sub = payload.sub
  if (!sub || typeof sub !== 'string') throw new Error('sub ausente')
  return sub
}

/** Como verifyUser, mas também retorna o e-mail (claim `email`) para gates administrativos. */
export async function verifyUserWithEmail(authHeader: string | null): Promise<{ userId: string; email: string | null }> {
  const payload = await verify(authHeader)
  const sub = payload.sub
  if (!sub || typeof sub !== 'string') throw new Error('sub ausente')
  const email = typeof payload.email === 'string' ? payload.email : null
  return { userId: sub, email }
}
