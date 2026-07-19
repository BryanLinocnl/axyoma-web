// Chamadas administrativas ao Postgres via PostgREST RPC, com a service-role key.
// Fetch puro (sem SDK) para rodar no runtime edge. Nunca exponha estas funções
// sem antes verificar o JWT do usuário na rota.

import type { BillingConfig } from '@/lib/credits'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

function assertEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
  return { url: SUPABASE_URL, key: SERVICE_ROLE }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { url, key } = assertEnv()
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`rpc ${fn} falhou (${res.status}): ${detail}`)
  }
  return (await res.json()) as T
}

/**
 * Config de preço NÃO-sensível (tabela `billing_config`, linha única). Devolve
 * SOMENTE os campos públicos — nunca `abacatepay_product_id`/mapas de produto
 * ou qualquer segredo. Fonte da conversão créditos→BRL.
 */
export async function getBillingConfig(): Promise<BillingConfig> {
  const { url, key } = assertEnv()
  const res = await fetch(
    `${url}/rest/v1/billing_config?select=credit_brl,usd_brl_rate,margin_multiplier,rate_updated_at&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`billing_config falhou (${res.status}): ${detail}`)
  }
  const rows = (await res.json()) as Partial<BillingConfig>[]
  const row = rows[0] ?? {}
  return {
    credit_brl: Number(row.credit_brl ?? 0.3),
    usd_brl_rate: Number(row.usd_brl_rate ?? 0),
    margin_multiplier: Number(row.margin_multiplier ?? 0),
    rate_updated_at: row.rate_updated_at ?? null,
  }
}

/** Saldo atual do usuário (gate pré-request). Retorna número (créditos). */
export async function getBalance(userId: string): Promise<number> {
  const v = await rpc<number>('get_balance_admin', { p_user: userId })
  return typeof v === 'number' ? v : Number(v ?? 0)
}

/**
 * Grava (cifrado) um segredo de integração no Supabase Vault, via RPC
 * SECURITY DEFINER (`integration_secret_set`) executada com a service-role.
 * O valor NUNCA é persistido em `integrations_config` nem devolvido ao browser.
 * Ver migration `..._integration_secrets_vault.sql` e edge function de leitura
 * (`integration-secret-read`) usada pelo desktop.
 */
export async function setIntegrationSecret(params: {
  userId: string
  provider: string
  field: string
  value: string
}): Promise<void> {
  await rpc('integration_secret_set', {
    p_user: params.userId,
    p_provider: params.provider,
    p_field: params.field,
    p_value: params.value,
  })
}

export type AdminMetrics = {
  total_users: number
  new_users_30d: number
  total_purchased_credits: number
  total_balance_credits: number
  active_subscriptions: number
  spend_today_credits: number
  spend_7d_credits: number
  spend_30d_credits: number
  by_model_30d: { model: string | null; calls: number; credits: number; prompt_tokens: number; completion_tokens: number }[]
  daily_30d: { day: string; credits: number; calls: number }[]
}

/** Painel developer: agregados globais (todos os usuários). Nunca exponha sem checar admin antes. */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  return rpc<AdminMetrics>('admin_metrics_summary', {})
}

// -----------------------------------------------------------------------------
// Rate limiting (sliding/fixed-window por usuário) via RPC `rate_limit_hit`.
// A contagem vive no Postgres (sem Redis/Upstash). A RPC é atômica e devolve se
// o request está dentro do limite. Ver migration `..._rate_limit.sql`.
//
// FAIL-OPEN: se a RPC/tabela ainda não foi aplicada (deploy do código antes da
// migration) ou o banco falha, NÃO bloqueamos o usuário — apenas logamos. Assim
// o rollout do código não derruba o proxy; o limite passa a valer quando a
// migration for aplicada.
// -----------------------------------------------------------------------------
export type RateLimitResult = {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: string | null
}

export async function checkRateLimit(params: {
  userId: string
  bucket: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  try {
    const r = await rpc<{ allowed: boolean; remaining: number; limit: number; reset_at: string | null }>(
      'rate_limit_hit',
      {
        p_user: params.userId,
        p_bucket: params.bucket,
        p_limit: params.limit,
        p_window_seconds: params.windowSeconds,
      },
    )
    return { allowed: r.allowed, remaining: r.remaining, limit: r.limit, resetAt: r.reset_at }
  } catch (e) {
    console.error('rate_limit_hit indisponível (fail-open):', (e as Error).message)
    return { allowed: true, remaining: params.limit, limit: params.limit, resetAt: null }
  }
}

/**
 * Marcador de reconciliação: registra uma geração que NÃO pôde ser debitada de
 * forma confiável (débito lançou exceção) para conciliação posterior — sem risco
 * de cobrança dupla. Best-effort (nunca quebra a resposta). Ver tabela
 * `pending_charges` na migration de integridade de crédito.
 */
export async function recordPendingCharge(params: {
  userId: string
  kind: 'chat' | 'image'
  model?: string | null
  costUsd?: number | null
  reason: string
}): Promise<void> {
  try {
    const { url, key } = assertEnv()
    await fetch(`${url}/rest/v1/pending_charges`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: params.userId,
        kind: params.kind,
        model: params.model ?? null,
        cost_usd: params.costUsd ?? null,
        reason: params.reason,
      }),
    })
  } catch (e) {
    console.error('recordPendingCharge falhou:', (e as Error).message)
  }
}

/** Debita o custo real (USD) do turno; a conversão p/ créditos é feita no banco. */
export async function debitUsage(params: {
  userId: string
  costUsd: number
  model?: string | null
  promptTokens?: number
  completionTokens?: number
}): Promise<void> {
  await rpc('spend_openrouter_usage_admin', {
    p_user: params.userId,
    p_cost_usd: params.costUsd,
    p_model: params.model ?? null,
    p_prompt_tokens: params.promptTokens ?? 0,
    p_completion_tokens: params.completionTokens ?? 0,
  })
}
