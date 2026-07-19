// Conversão créditos → BRL. A taxa é a FONTE DE VERDADE do banco
// (`billing_config.credit_brl`), nunca hardcode e nunca env var (env exigiria
// redeploy pra mudar preço; o banco não). O fallback abaixo existe só para não
// quebrar a UI se o fetch da config falhar — não é a fonte oficial.

export type BillingConfig = {
  credit_brl: number
  usd_brl_rate: number
  margin_multiplier: number
  rate_updated_at: string | null
}

/** Último recurso quando a config do banco não carrega. Não é a fonte oficial. */
export const FALLBACK_CREDIT_BRL = 0.3

/** Converte créditos em BRL usando `credit_brl` do banco (com fallback seguro). */
export function creditsToBRL(credits: number, creditBrl?: number | null): number {
  const rate = typeof creditBrl === 'number' && creditBrl > 0 ? creditBrl : FALLBACK_CREDIT_BRL
  return credits * rate
}

/**
 * Busca a config de preço NÃO-sensível no endpoint server (JWT-gated).
 * Retorna null em qualquer falha para o chamador aplicar o fallback.
 */
export async function fetchBillingConfig(token: string): Promise<BillingConfig | null> {
  try {
    const res = await fetch('/api/billing/config', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return (await res.json()) as BillingConfig
  } catch {
    return null
  }
}
