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
    `${url}/rest/v1/billing_config?select=credit_brl,usd_brl_rate,margin_multiplier,rate_updated_at,byok_route&limit=1`,
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
    // Valor desconhecido cai em 'proxy': é o caminho conhecido e com telemetria.
    // Um typo no banco não pode virar comportamento indefinido no cliente.
    byok_route: row.byok_route === 'direct' ? 'direct' : 'proxy',
  }
}

/**
 * Saldo TOTAL do usuário (gate pré-request): comprado + franquia de bônus.
 *
 * Continua devolvendo um número só de propósito — é o que todo gate de 402 usa
 * (`balance > 0`). Quem decide se o bônus pode ser gasto NAQUELA requisição é o
 * `hold_credits`, pelo `allowBonus`. O gate só precisa saber se há dinheiro.
 */
export async function getBalance(userId: string): Promise<number> {
  const v = await rpc<number>('get_balance_admin', { p_user: userId })
  return typeof v === 'number' ? v : Number(v ?? 0)
}

/** Saldo discriminado, para telas que mostram os dois potes separados. */
export type CreditBalances = {
  /** Crédito comprado. Vale em qualquer modelo. */
  balance: number
  /** Franquia de cadastro. Só sai em modelo Vertex. */
  bonus: number
  total: number
}

/**
 * Leitura discriminada dos dois potes.
 *
 * TOLERANTE À JANELA DE IMPLANTAÇÃO: se a migration do bônus ainda não foi
 * aplicada, a RPC não existe e caímos em `getBalance`, reportando tudo como
 * comprado e bônus 0. É o degrade certo — mostra um número verdadeiro (o total)
 * em vez de derrubar a tela.
 */
export async function getBalances(userId: string): Promise<CreditBalances> {
  try {
    const v = await rpc<{ balance?: number; bonus?: number; total?: number }>(
      'get_credit_balances_admin',
      { p_user: userId },
    )
    return {
      balance: Number(v?.balance ?? 0),
      bonus: Number(v?.bonus ?? 0),
      total: Number(v?.total ?? 0),
    }
  } catch {
    const total = await getBalance(userId)
    return { balance: total, bonus: 0, total }
  }
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
// FAIL-CLOSED por padrão (mudou na auditoria A-14): se a RPC não responde, a
// requisição é NEGADA. O fail-open anterior significava que uma migration não
// aplicada ou uma instabilidade do banco removia o único limite de gasto do
// produto — em todas as rotas ao mesmo tempo. Quem precisar do comportamento
// antigo passa `failOpen: true`, e só para buckets sem custo direto.
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
  /**
   * Comportamento quando a RPC de rate limit não responde.
   * `false` (padrão) = FAIL-CLOSED: nega. É o certo para buckets que gastam
   * dinheiro nosso (chat/imagem/vídeo/busca) — antes o fail-open significava
   * que uma migration não aplicada ou uma instabilidade removia o ÚNICO limite
   * de gasto do produto, em todas as rotas de uma vez.
   * `true` só para buckets sem custo direto.
   */
  failOpen?: boolean
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
    const failOpen = params.failOpen === true
    console.error(
      `rate_limit_hit indisponível (${failOpen ? 'fail-open' : 'FAIL-CLOSED'}):`,
      (e as Error).message,
    )
    return { allowed: failOpen, remaining: 0, limit: params.limit, resetAt: null }
  }
}

/**
 * Registra um turno pago pela chave DO USUÁRIO (BYOK). `credits = 0` — não há
 * nada a cobrar: o dinheiro é dele e o custo em USD é entre ele e o fornecedor.
 *
 * Guardamos tokens/modelo/latência porque é o que sustenta as telas de uso e o
 * diagnóstico ("por que este modelo está lento/errando"). NÃO guardamos custo:
 * seria inventar um número, já que a fatura não passa por nós.
 *
 * Best-effort: falhar aqui não pode afetar a resposta de um turno que já foi
 * entregue e que não nos custou nada.
 */
export async function logByokUsage(params: {
  userId: string
  provider: string
  model?: string | null
  promptTokens?: number
  completionTokens?: number
}): Promise<void> {
  try {
    const { url, key } = assertEnv()
    await fetch(`${url}/rest/v1/usage_log`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: params.userId,
        kind: 'byok',
        model: params.model ?? null,
        prompt_tokens: params.promptTokens ?? 0,
        completion_tokens: params.completionTokens ?? 0,
        credits: 0,
        meta: { via: 'proxy', source: 'byok', provider: params.provider },
      }),
    })
  } catch (e) {
    console.error('logByokUsage falhou:', (e as Error).message)
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
  kind: 'chat' | 'image' | 'video'
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

/**
 * Debita o custo real (USD) do turno; a conversão p/ créditos é feita no banco.
 *
 * Margem: a RPC `spend_openrouter_usage_admin` tem assinatura de 7 args, com
 * `p_margin_override numeric default null` NO FIM. Quando a env
 * `CREDIT_MARGIN_MULTIPLIER` estiver setada como um número válido, repassamos esse
 * valor como `p_margin_override` (sobrescreve `billing_config.margin_multiplier`
 * só nesta chamada, sem deploy). Sem a env → omitimos o arg (default null no banco
 * = comportamento atual idêntico).
 */
/**
 * Reserva créditos ANTES de chamar o upstream (auditoria C-7).
 *
 * O gate antigo era só uma leitura de saldo e o débito vinha no fim do stream:
 * N requisições simultâneas liam o mesmo saldo, todas passavam, o saldo ia a
 * negativo e a geração continuava. Aqui o débito da estimativa é atômico
 * (`where balance >= p_credits` no SQL), então a concorrência serializa.
 *
 * Retorna o `holdId`, que deve ser liquidado (settleHold) ou devolvido
 * (releaseHold). Lança `InsufficientCreditsError` quando não há saldo.
 */
export class InsufficientCreditsError extends Error {
  constructor() {
    super('créditos esgotados')
    this.name = 'InsufficientCreditsError'
  }
}

export async function holdCredits(params: {
  userId: string
  credits: number
  kind?: string
  model?: string | null
  /**
   * A franquia de bônus pode pagar esta requisição? SÓ para modelo Vertex.
   *
   * Default `false` — fail-closed de propósito: um chamador esquecido cobra do
   * pote comprado, o que no máximo é generoso com a gente e nunca libera a
   * franquia num modelo que não é Vertex. O erro barato é o que a gente escolhe.
   */
  allowBonus?: boolean
}): Promise<string> {
  try {
    return await rpc<string>('hold_credits', {
      p_user: params.userId,
      p_credits: params.credits,
      p_kind: params.kind ?? 'chat',
      p_model: params.model ?? null,
      p_allow_bonus: params.allowBonus === true,
    })
  } catch (e) {
    if (/saldo insuficiente/i.test((e as Error).message)) throw new InsufficientCreditsError()
    throw e
  }
}

/**
 * Troca a reserva pelo custo real (devolve a diferença) e registra o uso.
 * Retorna quantos CRÉDITOS foram cobrados — o valor exato, direto da função que
 * fez a conta. Antes as rotas de imagem/vídeo inferiam isso por diferença de
 * saldo (duas leituras extras, e qualquer cobrança concorrente do mesmo usuário
 * contaminava o número).
 */
export async function settleHold(params: {
  holdId: string
  costUsd: number
  model?: string | null
  promptTokens?: number
  completionTokens?: number
}): Promise<number> {
  const args: Record<string, unknown> = {
    p_hold: params.holdId,
    p_cost_usd: params.costUsd,
    p_model: params.model ?? null,
    p_prompt_tokens: params.promptTokens ?? 0,
    p_completion_tokens: params.completionTokens ?? 0,
  }
  const rawMargin = process.env.CREDIT_MARGIN_MULTIPLIER
  if (rawMargin != null && rawMargin.trim() !== '') {
    const margin = Number(rawMargin)
    if (Number.isFinite(margin)) args.p_margin_override = margin
  }
  const v = await rpc<number>('settle_hold', args)
  return typeof v === 'number' ? v : Number(v ?? 0)
}

/**
 * Dados de autenticação do usuário direto do GoTrue (service-role).
 *
 * Usado no gate do bônus de cadastro: o claim `email_verified` do JWT tem shape
 * diferente conforme o provedor (OAuth põe em `user_metadata`, e-mail/senha nem
 * sempre põe), então a confirmação é lida da FONTE — `email_confirmed_at` — em
 * vez de deduzida do token.
 */
export async function getAuthUser(userId: string): Promise<{ email: string | null; emailConfirmed: boolean }> {
  const { url, key } = assertEnv()
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`admin/users falhou (${res.status})`)
  const u = (await res.json()) as { email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null }
  return {
    email: u.email ?? null,
    emailConfirmed: Boolean(u.email_confirmed_at || u.confirmed_at),
  }
}

/**
 * Concede o bônus de cadastro (valor vem do ENV desta app, não do banco).
 * A RPC só credita se `signup_bonus_granted_at is null` — chamar várias vezes é
 * seguro. Retorna o saldo atual (tendo concedido agora ou não).
 */
export async function grantSignupBonus(userId: string, credits: number): Promise<number> {
  const v = await rpc<number>('grant_signup_bonus', { p_user: userId, p_credits: credits })
  return typeof v === 'number' ? v : Number(v ?? 0)
}

/** Devolve a reserva inteira (falha antes de gerar qualquer coisa). */
export async function releaseHold(holdId: string): Promise<void> {
  await rpc('release_hold', { p_hold: holdId })
}

export async function debitUsage(params: {
  userId: string
  costUsd: number
  model?: string | null
  promptTokens?: number
  completionTokens?: number
  /**
   * Mesma regra do `holdCredits`: só modelo Vertex pode consumir a franquia.
   * Importa aqui porque este é o caminho SEM reserva, e o caso principal dele é
   * justamente Vertex — a geração de imagem do `proxyVertexImage`, que gera
   * primeiro e debita depois. Sem isto a imagem queimaria crédito comprado com
   * a franquia parada ao lado.
   */
  allowBonus?: boolean
}): Promise<void> {
  const args: Record<string, unknown> = {
    p_user: params.userId,
    p_cost_usd: params.costUsd,
    p_model: params.model ?? null,
    p_prompt_tokens: params.promptTokens ?? 0,
    p_completion_tokens: params.completionTokens ?? 0,
    p_allow_bonus: params.allowBonus === true,
  }

  const rawMargin = process.env.CREDIT_MARGIN_MULTIPLIER
  if (rawMargin != null && rawMargin.trim() !== '') {
    const margin = Number(rawMargin)
    // Só repassa se for número finito; caso contrário mantém o default do banco.
    if (Number.isFinite(margin)) args.p_margin_override = margin
  }

  await rpc('spend_openrouter_usage_admin', args)
}

/**
 * Soma o gasto (USD) do dia corrente do usuário, lido de `usage_log` (o custo em
 * USD vive no campo `meta.cost_usd` gravado pela RPC de débito). É a base do cap
 * de gasto diário OPCIONAL (§7) — só chamado quando `DAILY_SPEND_CAP_USD > 0`.
 *
 * FAIL-OPEN: se a leitura falhar (infra/rede), devolve 0 para NÃO bloquear o
 * usuário por erro de infraestrutura numa feature opcional. O `limit` alto é uma
 * trava de sanidade (o dia dificilmente terá tantas gerações por usuário).
 */
export async function getSpendTodayUsd(userId: string): Promise<number> {
  try {
    const { url, key } = assertEnv()
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const qs = new URLSearchParams({
      user_id: `eq.${userId}`,
      ts: `gte.${startOfDay.toISOString()}`,
      select: 'meta',
      limit: '10000',
    })
    const res = await fetch(`${url}/rest/v1/usage_log?${qs.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    // Também FAIL-CLOSED: um 5xx do PostgREST zerava o gasto do dia e liberava o
    // cap tão bem quanto uma exceção teria feito.
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`usage_log select falhou (${res.status}): ${detail.slice(0, 200)}`)
    }
    const rows = (await res.json()) as { meta?: { cost_usd?: unknown } | null }[]
    let total = 0
    for (const r of rows) {
      const c = Number(r.meta?.cost_usd)
      if (Number.isFinite(c) && c > 0) total += c
    }
    return total
  } catch (e) {
    // Propaga: devolver 0 aqui DESLIGAVA silenciosamente o cap diário de gasto
    // numa instabilidade do banco. Quem chama decide (a rota de chat trata como
    // indisponibilidade e recusa, em vez de liberar gasto ilimitado).
    console.error('getSpendTodayUsd indisponível:', (e as Error).message)
    throw e
  }
}
