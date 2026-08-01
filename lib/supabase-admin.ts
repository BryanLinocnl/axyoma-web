// Chamadas administrativas ao Postgres via PostgREST RPC, com a service-role key.
// Fetch puro (sem SDK) para rodar no runtime edge. Nunca exponha estas funções
// sem antes verificar o JWT do usuário na rota.

import type { BillingConfig } from '@/lib/credits'
import { isAdminEmail } from '@/lib/admin'

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

/** Recursos efetivos de um usuário. Objeto SEMPRE completo — ver `getEntitlements`. */
export type Entitlements = {
  /** Id no banco: 'free' | 'solo' | 'teams'. O app compara por aqui. */
  planId: string
  /** Nome de exibição: 'Free' | 'Pro' | 'Teams'. O site mostra este. */
  planName: string
  features: {
    design: boolean
    skillsCatalog: boolean
    skillTiers: string[]
    maxMembers: number
    /** Canais de mensagem (Telegram/WhatsApp) no desktop. Pro e Teams. */
    messaging: boolean
  }
}

/** O que TODO usuário tem, inclusive quando nada carrega. Nunca liberar daqui. */
const FREE_ENTITLEMENTS: Entitlements = {
  planId: 'free',
  planName: 'Free',
  features: { design: false, skillsCatalog: false, skillTiers: [], maxMembers: 1, messaging: false },
}

/**
 * Recursos efetivos do usuário: assinatura ativa → plano → `features`.
 *
 * DEVOLVE SEMPRE O OBJETO COMPLETO, nunca um patch e nunca `{}`. Um objeto
 * parcial no cliente vira `features.design === undefined`, que por sorte é
 * falsy — e segurança por sorte deixa de funcionar no dia em que alguém inverte
 * uma condição.
 *
 * Sem assinatura ativa, ou qualquer falha: FREE. Nunca o contrário. Este é o
 * único lugar do sistema que decide o que alguém pode usar; errar para o lado
 * generoso aqui é dar produto de graça, e errar em silêncio.
 */
export async function getEntitlements(userId: string, email?: string | null): Promise<Entitlements> {
  // DEVELOPER TEM TUDO. A equipe usa o app o dia inteiro para testar, e um
  // recurso escondido atrás do plano é um recurso que ninguém da equipe exercita
  // antes do cliente — foi o que aconteceu com os canais de mensagem.
  //
  // Mesmo critério do teto diário em `chat/completions`: a concessão é a env
  // `ADMIN_EMAILS`, não `profiles.role`. Ler o papel da tabela aqui abriria um
  // segundo caminho para virar developer, e quem escreve naquela coluna é
  // justamente a sincronização que parte desta env.
  //
  // O `planId` continua sendo o REAL. Mentir aqui faria a tela de conta mostrar
  // uma assinatura que não existe, e a cobrança discordaria da interface.
  if (isAdminEmail(email ?? null)) {
    const real = await planoReal(userId)
    return {
      planId: real?.id ?? 'free',
      planName: real?.name ?? 'Free',
      features: { design: true, skillsCatalog: true, skillTiers: ['common', 'teams'], maxMembers: 4, messaging: true },
    }
  }
  const plano = await planoReal(userId)
  if (!plano) return FREE_ENTITLEMENTS
  const f = (plano.features ?? {}) as Record<string, unknown>
  return {
    planId: String(plano.id),
    planName: String(plano.name ?? 'Free'),
    // Cada campo normalizado contra o default do Free: um plano cuja coluna
    // `features` esteja vazia ou malformada entrega o mínimo, não o máximo.
    features: {
      design: f.design === true,
      skillsCatalog: f.skillsCatalog === true,
      skillTiers: Array.isArray(f.skillTiers) ? f.skillTiers.map(String) : [],
      maxMembers: Number.isFinite(Number(f.maxMembers)) ? Number(f.maxMembers) : 1,
      messaging: f.messaging === true,
    },
  }
}

/** Plano da assinatura ATIVA do usuário. `null` quando não há (ou falhou). */
async function planoReal(
  userId: string,
): Promise<{ id?: string; name?: string; features?: Record<string, unknown> } | null> {
  try {
    const { url, key } = assertEnv()
    const qs = new URLSearchParams({
      select: 'plans(id,name,features)',
      owner_user_id: `eq.${userId}`,
      status: 'eq.active',
      limit: '1',
    })
    const res = await fetch(`${url}/rest/v1/subscriptions?${qs.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`subscriptions falhou (${res.status})`)
    const rows = (await res.json()) as { plans?: { id?: string; name?: string; features?: Record<string, unknown> } }[]
    const plano = rows[0]?.plans
    return plano?.id ? plano : null
  } catch (e) {
    console.error('planoReal falhou (degradando para Free):', (e as Error).message)
    return null
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

/**
 * Métricas do painel interno.
 *
 * O tipo anterior (`total_users`, `by_model_30d`, `daily_30d`) descrevia uma RPC
 * que NUNCA existiu no banco — a página respondia "falha ao carregar métricas"
 * desde sempre, e a mensagem genérica escondia a causa. O shape abaixo é o da
 * RPC de verdade, agrupado por assunto e com o que faltava: custo em dólar,
 * consumo interno da equipe separado, e saúde (erros, abortos, TTFT).
 */
export type AdminMetrics = {
  usuarios: { total: number; novos_30d: number; ativos_7d: number; ativos_30d: number }
  receita: {
    creditos_comprados: number
    compras: number
    assinaturas_ativas: number
    saldo_em_circulacao: number
  }
  custo: {
    usd_30d: number
    usd_7d: number
    creditos_30d: number
    /** Consumo da equipe (papel developer). Não debita, mas é medido — some do
     *  custo por usuário pagante se for misturado. */
    usd_interno_30d: number
  }
  uso: {
    chamadas_30d: number
    tokens_30d: number
    byok_chamadas_30d: number
    imagens: number
    videos: number
  }
  saude: {
    turnos_7d: number
    erros_7d: number
    abortos_7d: number
    /** Turnos que bateram o teto de iterações. */
    cap_7d: number
    ttft_p50_ms: number | null
    ttft_p95_ms: number | null
    /** Reservas abertas há mais de uma hora: crédito preso ou vazado. */
    holds_presos: number
  }
}

export type AdminSeriePonto = {
  dia: string
  usd: number
  creditos: number
  chamadas: number
  tokens: number
  erros: number
  usuarios: number
}

export type AdminErrorGroup = {
  chave: string
  titulo: string
  mensagem: string | null
  error_class: string | null
  bucket: 'bug' | 'ambiente'
  ocorrencias: number
  usuarios: number
  primeira: string
  ultima: string
  versoes: string[] | null
  ultima_versao: string | null
  variacoes: number
  modo: string | null
  provider: string | null
  model_id: string | null
  tool: string | null
  stack: string | null
  status: 'novo' | 'investigando' | 'corrigido' | 'ignorado'
  fixed_in_version: string | null
  nota: string | null
}

/** Painel developer: agregados globais (todos os usuários). Nunca exponha sem checar admin antes. */
export async function getAdminMetrics(userId: string): Promise<AdminMetrics> {
  // `userId` VERIFICADO pela rota, nunca vindo do corpo. Ele é necessário porque
  // `rpc()` usa a service role, e com ela `auth.uid()` é nulo no Postgres — sem
  // isto a própria RPC recusaria a chamada legítima com "acesso negado".
  return rpc<AdminMetrics>('admin_metrics_summary', { p_user: userId })
}

export async function getAdminSeries(userId: string, dias = 30): Promise<AdminSeriePonto[]> {
  return rpc<AdminSeriePonto[]>('admin_daily_series', { p_dias: dias, p_user: userId })
}

export async function getAdminErrorGroups(params: {
  userId: string
  bucket?: 'bug' | 'ambiente' | null
  dias?: number
  limite?: number
  porVariacao?: boolean
}): Promise<AdminErrorGroup[]> {
  return rpc<AdminErrorGroup[]>('admin_error_groups', {
    p_bucket: params.bucket ?? null,
    p_dias: params.dias ?? 30,
    p_limite: params.limite ?? 100,
    p_por_variacao: params.porVariacao ?? false,
    p_user: params.userId,
  })
}

export async function setErrorTriage(params: {
  userId: string
  fingerprint: string
  status: string
  fixedInVersion?: string | null
  nota?: string | null
}): Promise<unknown> {
  return rpc('admin_error_triage', {
    p_fingerprint: params.fingerprint,
    p_status: params.status,
    p_fixed_in_version: params.fixedInVersion ?? null,
    p_nota: params.nota ?? null,
    p_user: params.userId,
  })
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
