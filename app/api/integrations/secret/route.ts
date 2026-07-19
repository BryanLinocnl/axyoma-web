import { z } from 'zod'
import { verifyUser } from '@/lib/auth'
import { setIntegrationSecret } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

// =============================================================================
// Armazenamento seguro de segredos de integração (P4) — Supabase Vault.
//
// FLUXO (documentado):
//   1. O browser envia { provider, field, value } SOMENTE para este endpoint
//      HTTPS do nosso servidor (com o Authorization bearer do usuário).
//   2. Verificamos o JWT → userId. Validamos provider/field/value (caps).
//   3. Chamamos a RPC SECURITY DEFINER `integration_secret_set` com a
//      service-role: ela cifra o valor no Vault (`vault.create_secret` /
//      `vault.update_secret`) e mapeia (user_id, provider, field) → secret id em
//      `integration_secrets`. RLS + grants impedem qualquer acesso do browser.
//   4. O segredo NUNCA é gravado em `integrations_config` (que é claro) nem
//      devolvido ao browser. O desktop recupera via a edge function autenticada
//      `integration-secret-read` (JWT do dono), que descifra server-side.
//
// Assim o valor só trafega browser→nosso servidor (TLS)→Vault; nunca volta ao
// client e nunca fica em claro na nuvem.
// =============================================================================
export const runtime = 'edge'

const MAX_SECRET_LEN = 4096

const BodySchema = z.object({
  provider: z.enum(['github', 'vercel', 'mcp']),
  field: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_.:-]+$/),
  value: z.string().min(1).max(MAX_SECRET_LEN),
})

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
}

export async function POST(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'POST, OPTIONS')
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado' } })
  }

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return json(400, { error: { message: 'corpo inválido' } })
  }
  const result = BodySchema.safeParse(parsed)
  if (!result.success) {
    return json(400, { error: { message: 'parâmetros inválidos (provider/field/value)' } })
  }

  try {
    await setIntegrationSecret({
      userId,
      provider: result.data.provider,
      field: result.data.field,
      value: result.data.value,
    })
  } catch (e) {
    console.error('integration_secret_set falhou:', (e as Error).message)
    return json(502, { error: { message: 'não foi possível salvar a credencial com segurança' } })
  }

  // Nunca ecoamos o valor. Só confirmamos que foi cifrado e guardado.
  return json(200, { ok: true, provider: result.data.provider, field: result.data.field })
}
