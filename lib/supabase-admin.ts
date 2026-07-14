// Chamadas administrativas ao Postgres via PostgREST RPC, com a service-role key.
// Fetch puro (sem SDK) para rodar no runtime edge. Nunca exponha estas funções
// sem antes verificar o JWT do usuário na rota.

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

/** Saldo atual do usuário (gate pré-request). Retorna número (créditos). */
export async function getBalance(userId: string): Promise<number> {
  const v = await rpc<number>('get_balance_admin', { p_user: userId })
  return typeof v === 'number' ? v : Number(v ?? 0)
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
