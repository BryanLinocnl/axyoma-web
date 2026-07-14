import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from 'jose'

// Verificação de JWT do Supabase feita LOCALMENTE (sem round-trip ao Supabase
// no hot path). Suporta os dois modos de assinatura:
//  - HS256 (legado): usa o SUPABASE_JWT_SECRET.
//  - ES256/RS256 (assimétrico): usa a JWKS pública do projeto (cacheada por jose).

const SUPABASE_URL = process.env.SUPABASE_URL
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET

let jwks: JWTVerifyGetKey | null = null
function getJwks(): JWTVerifyGetKey {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL ausente')
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  }
  return jwks
}

/** Retorna o user id (claim `sub`) se o token for válido; lança se inválido/expirado. */
export async function verifyUser(authHeader: string | null): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('authorization ausente')
  }
  const token = authHeader.slice(7).trim()

  const { payload } = JWT_SECRET
    ? await jwtVerify(token, new TextEncoder().encode(JWT_SECRET))
    : await jwtVerify(token, getJwks())

  const sub = payload.sub
  if (!sub || typeof sub !== 'string') throw new Error('sub ausente')
  return sub
}
