// Registro de modelos: FONTE DE VERDADE = tabela `public.models` no Supabase.
// Resolve o roteamento (vertex/openrouter/...) a partir do id canônico do modelo.
//
// SERVER-ONLY: este módulo lê colunas sensíveis de roteamento (upstream_model_id,
// vertex_publisher, region, preços, etc.) com a service-role key. NUNCA importe em
// código de client. Só use dentro de rotas/handlers server (mesmo padrão do
// `supabase-admin.ts`). A projeção `toPublicModel()` é a ÚNICA forma segura de
// expor um modelo ao browser.

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Provedores de upstream suportados. FASE 1: só 'vertex' e 'openrouter' ativos. */
export type ModelProvider = 'vertex' | 'openrouter' | 'openai' | 'groq'

/** Dialeto da API do upstream. FASE 1: só 'openai' (sem adaptador anthropic ainda). */
export type ApiFlavor = 'openai' | 'anthropic'

/**
 * Linha resolvida de `public.models` — TIPO SERVER-ONLY. Contém colunas de
 * roteamento que jamais podem vazar pro client. Use `toPublicModel()` para obter
 * a visão segura antes de qualquer serialização voltada ao browser.
 */
export type ResolvedModel = {
  /** id canônico (== id OpenRouter, usado p/ dedup do catálogo). */
  id: string
  provider: ModelProvider
  api_flavor: ApiFlavor
  /** Publisher no Vertex (ex.: 'google'). Só relevante p/ provider 'vertex'. */
  vertex_publisher: string | null
  /** id real do modelo no upstream (o que vai no corpo da chamada). */
  upstream_model_id: string
  /** Location/region do upstream. Vira host do endpoint Vertex → anti-SSRF. */
  region: string | null
  input_price_usd_per_mtok: number
  output_price_usd_per_mtok: number
  image_price_usd: number | null
  enabled: boolean
  supports_tools: boolean
  supports_reasoning: boolean
}

/** Visão PÚBLICA de um modelo — segura para enviar ao client. Sem roteamento. */
export type PublicModel = {
  id: string
  supports_tools: boolean
  supports_reasoning: boolean
  input_price_usd_per_mtok: number
  output_price_usd_per_mtok: number
  image_price_usd: number | null
}

/** Erro de segurança: region do modelo não está na allowlist (possível SSRF). */
export class RegionNotAllowedError extends Error {
  readonly region: string | null
  constructor(region: string | null) {
    super(`region '${region ?? '(vazia)'}' fora de VERTEX_ALLOWED_LOCATIONS`)
    this.name = 'RegionNotAllowedError'
    this.region = region
  }
}

// Colunas buscadas explicitamente (evita SELECT * e evita puxar lixo/segredo extra).
const SELECT_COLS = [
  'id',
  'provider',
  'api_flavor',
  'vertex_publisher',
  'upstream_model_id',
  'region',
  'input_price_usd_per_mtok',
  'output_price_usd_per_mtok',
  'image_price_usd',
  'enabled',
  'supports_tools',
  'supports_reasoning',
].join(',')

// ---------------------------------------------------------------------------
// Cache em memória curto (~60s). Vive por isolate do edge (best-effort): reduz
// hits no Postgres em rajadas sem segurar preço/enabled desatualizado por muito
// tempo. Cacheamos também o "miss" (null) pra não martelar em id inexistente.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60_000
type CacheEntry = { value: ResolvedModel | null; expiresAt: number }
const cache = new Map<string, CacheEntry>()

/** Conjunto de locations permitidas (csv em VERTEX_ALLOWED_LOCATIONS), normalizado. */
function allowedLocations(): Set<string> {
  const raw = process.env.VERTEX_ALLOWED_LOCATIONS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** true se `region` está na allowlist. allowlist vazia => nega tudo (fail-closed). */
export function isRegionAllowed(region: string | null | undefined): boolean {
  if (!region) return false
  return allowedLocations().has(region.trim().toLowerCase())
}

function assertEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
  return { url: SUPABASE_URL, key: SERVICE_ROLE }
}

/** Normaliza a linha crua do PostgREST para o tipo estrito, com defaults seguros. */
function normalize(row: Record<string, unknown>): ResolvedModel {
  const num = (v: unknown, d = 0): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
  return {
    id: String(row.id),
    provider: (row.provider as ModelProvider) ?? 'openrouter',
    api_flavor: (row.api_flavor as ApiFlavor) ?? 'openai',
    vertex_publisher: str(row.vertex_publisher),
    upstream_model_id: typeof row.upstream_model_id === 'string' ? row.upstream_model_id : String(row.id),
    region: str(row.region),
    input_price_usd_per_mtok: num(row.input_price_usd_per_mtok),
    output_price_usd_per_mtok: num(row.output_price_usd_per_mtok),
    image_price_usd: row.image_price_usd == null ? null : num(row.image_price_usd),
    enabled: row.enabled === true,
    supports_tools: row.supports_tools === true,
    supports_reasoning: row.supports_reasoning === true,
  }
}

/**
 * Resolve um modelo pelo id canônico.
 *
 * - Retorna `null` se não existir ou se `enabled = false`.
 * - Se o modelo for `provider = 'vertex'`, a `region` é validada contra
 *   VERTEX_ALLOWED_LOCATIONS; region inválida LANÇA `RegionNotAllowedError`
 *   (anti-SSRF — não é um "não encontrado", é uma recusa de segurança).
 * - Resultado (inclusive miss) fica em cache ~60s por isolate.
 */
export async function resolveModel(id: string): Promise<ResolvedModel | null> {
  const key = id.trim()
  if (!key) return null

  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    return validateRegion(cached.value)
  }

  const { url, key: apiKey } = assertEnv()
  const qs = new URLSearchParams({
    id: `eq.${key}`,
    select: SELECT_COLS,
    limit: '1',
  })
  const res = await fetch(`${url}/rest/v1/models?${qs.toString()}`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`models lookup falhou (${res.status}): ${detail}`)
  }
  const rows = (await res.json()) as Record<string, unknown>[]
  const row = rows[0]

  let value: ResolvedModel | null = null
  if (row) {
    const model = normalize(row)
    value = model.enabled ? model : null
  }

  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS })
  return validateRegion(value)
}

/**
 * Guard anti-SSRF: para modelos Vertex, a region PRECISA estar na allowlist,
 * pois ela vira o host do endpoint. Não-vertex não usa region → passa direto.
 */
function validateRegion(model: ResolvedModel | null): ResolvedModel | null {
  if (!model) return null
  if (model.provider === 'vertex' && !isRegionAllowed(model.region)) {
    throw new RegionNotAllowedError(model.region)
  }
  return model
}

/** Projeta um modelo resolvido para a visão pública (sem colunas de roteamento). */
export function toPublicModel(m: ResolvedModel): PublicModel {
  return {
    id: m.id,
    supports_tools: m.supports_tools,
    supports_reasoning: m.supports_reasoning,
    input_price_usd_per_mtok: m.input_price_usd_per_mtok,
    output_price_usd_per_mtok: m.output_price_usd_per_mtok,
    image_price_usd: m.image_price_usd,
  }
}

/** Limpa o cache (útil em testes). */
export function __clearModelCache(): void {
  cache.clear()
}
