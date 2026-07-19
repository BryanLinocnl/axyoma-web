import type { Provider } from './types'

// Envia um segredo de integração APENAS ao nosso endpoint HTTPS
// `/api/integrations/secret` (com o bearer do usuário), que o cifra no Supabase
// Vault. O valor NUNCA é gravado em `integrations_config` (claro) nem devolvido
// ao browser — só o desktop autenticado o recupera. Ver `secret-field.tsx` e a
// migration `..._integration_secrets_vault.sql`.
//
// `field` deve casar com o regex do endpoint: ^[a-zA-Z0-9_.:-]+$ (máx 64).
export async function postSecret(params: {
  token: string
  provider: Provider
  field: string
  value: string
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/integrations/secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.token}` },
      body: JSON.stringify({ provider: params.provider, field: params.field, value: params.value }),
    })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } }
    if (res.ok && body?.ok) return { ok: true }
    return { ok: false, message: body?.error?.message ?? 'Não foi possível salvar a credencial.' }
  } catch {
    return { ok: false, message: 'Falha de rede ao contatar o serviço de credenciais.' }
  }
}
