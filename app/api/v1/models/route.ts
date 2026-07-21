import { corsHeaders } from '@/lib/cors'

// Catálogo de modelos — MERGE de duas fontes:
//   1) catálogo PÚBLICO da OpenRouter (a rota /models não exige chave), como
//      "piso" da lista — traz todo o universo de modelos disponíveis;
//   2) tabela `public.models` (Supabase) como OVERLAY com PRECEDÊNCIA — permite
//      curadoria (preço próprio, habilitar/desabilitar, adicionar modelos que a
//      OpenRouter não lista, ex.: Vertex/Gemini direto).
//
// Dedup por id canônica: quando o mesmo id existe nas duas fontes (ex.:
// "google/gemini-3-pro-image"), a linha da TABELA vence e aparece uma única
// vez. Modelo só na tabela ou só na OpenRouter também aparece.
//
// NÃO exige login: a lista de modelos é dado público; o que precisa de auth é
// a SELEÇÃO do usuário (tabela model_selection, sob RLS), feita separadamente
// no cliente. Proxiamos aqui só para evitar CORS do browser, manter a origem
// única e nunca expor OPENROUTER_KEY/SERVICE_ROLE_KEY ao cliente.
//
// Shape de resposta preservado: { data: RawModel[] } — é o que
// `lib/openrouter-catalog.ts` espera (ver `RawModel` lá).
//
// SEGURANÇA: da tabela `public.models` só selecionamos colunas seguras para
// expor ao cliente. NUNCA incluir aqui `provider`, `api_flavor`,
// `upstream_model_id`, `region`, `vertex_publisher` — são detalhes internos de
// roteamento do proxy (Vertex/OpenRouter/OpenAI/Groq) e não devem vazar.
export const runtime = 'edge'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

// Shape esperado por `lib/openrouter-catalog.ts` (RawModel). Mantido local
// (sem exportar) — é só o contrato desta rota.
interface RawModel {
  id: string
  name?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  architecture?: {
    input_modalities?: string[]
    output_modalities?: string[]
  }
  supported_parameters?: string[]
  // Teto de imagens de REFERÊNCIA que o modelo aceita numa geração img2img.
  // Só a tabela `public.models` popula isto (coluna max_reference_images); os
  // modelos vindos só da OpenRouter ficam sem o campo (cliente aplica fallback).
  max_reference_images?: number
}

// Linha de `public.models` — SOMENTE colunas seguras para expor (ver comentário
// de segurança acima). O `select=` da query já restringe isso na origem.
interface ModelsTableRow {
  id: string
  display_name: string
  context_length: number
  input_modalities: string[]
  output_modalities: string[]
  supported_parameters: string[]
  input_price_usd_per_mtok: number | string
  output_price_usd_per_mtok: number | string
  sort_order: number
  max_reference_images: number | null
}

const MODELS_TABLE_SELECT =
  'id,display_name,context_length,input_modalities,output_modalities,supported_parameters,input_price_usd_per_mtok,output_price_usd_per_mtok,sort_order,max_reference_images'

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'GET, OPTIONS') })
}

// Busca o catálogo público da OpenRouter. Falha -> [] (degrada com graça: a
// resposta final ainda traz os modelos da tabela).
async function fetchOpenRouterCatalog(): Promise<RawModel[]> {
  try {
    const key = process.env.OPENROUTER_KEY
    const res = await fetch(`${OPENROUTER}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    })
    if (!res.ok) {
      console.error(`OpenRouter /models HTTP ${res.status}`)
      return []
    }
    const json = (await res.json()) as { data?: RawModel[] }
    return json.data ?? []
  } catch (e) {
    console.error('OpenRouter /models indisponível (degradando para só a tabela):', (e as Error).message)
    return []
  }
}

// Busca os modelos habilitados de `public.models`. Falha -> [] (degrada com
// graça: a resposta final ainda traz o catálogo da OpenRouter).
//
// Usa a service-role key (mesmo padrão de `lib/supabase-admin.ts`) para não
// depender da anon key estar configurada neste ambiente; a policy
// `models_public_read` (RLS) já permitiria o mesmo select com a anon key.
async function fetchModelsTable(): Promise<ModelsTableRow[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('SUPABASE_URL/SERVICE_ROLE_KEY ausentes — pulando overlay da tabela public.models')
    return []
  }
  try {
    const qs = new URLSearchParams({
      select: MODELS_TABLE_SELECT,
      enabled: 'eq.true',
      order: 'sort_order.asc',
    })
    const res = await fetch(`${SUPABASE_URL}/rest/v1/models?${qs.toString()}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`public.models select falhou (${res.status}): ${detail}`)
      return []
    }
    return (await res.json()) as ModelsTableRow[]
  } catch (e) {
    console.error('public.models indisponível (degradando para só a OpenRouter):', (e as Error).message)
    return []
  }
}

// Preço na tabela é USD por milhão de tokens; `RawModel.pricing.*` (mesmo
// contrato da OpenRouter) é USD POR TOKEN, como string.
function usdPerMtokToPerToken(v: number | string): string {
  const n = Number(v)
  return Number.isFinite(n) ? String(n / 1e6) : '0'
}

// Linha da tabela -> mesmo shape RawModel da OpenRouter (só campos seguros).
function tableRowToRawModel(row: ModelsTableRow): RawModel {
  return {
    id: row.id,
    name: row.display_name,
    context_length: row.context_length ?? 0,
    pricing: {
      prompt: usdPerMtokToPerToken(row.input_price_usd_per_mtok),
      completion: usdPerMtokToPerToken(row.output_price_usd_per_mtok),
    },
    architecture: {
      input_modalities: row.input_modalities ?? [],
      output_modalities: row.output_modalities ?? [],
    },
    supported_parameters: row.supported_parameters ?? [],
    // null → undefined: JSON.stringify omite o campo; o cliente aplica o fallback.
    max_reference_images: row.max_reference_images ?? undefined,
  }
}

type MergedEntry = { raw: RawModel; fromTable: boolean; sortOrder: number; orIndex: number }

// MERGE por id, precedência da TABELA. Ordenação final: entradas da tabela
// primeiro (por sort_order asc), depois as só-OpenRouter na ordem original
// devolvida pela OpenRouter (ordem estável, sem re-rankear o catálogo público).
function mergeCatalogs(openrouter: RawModel[], table: ModelsTableRow[]): RawModel[] {
  const merged = new Map<string, MergedEntry>()

  openrouter.forEach((raw, orIndex) => {
    merged.set(raw.id, { raw, fromTable: false, sortOrder: Number.POSITIVE_INFINITY, orIndex })
  })

  table.forEach((row) => {
    const raw = tableRowToRawModel(row)
    const prev = merged.get(row.id)
    merged.set(row.id, {
      raw,
      fromTable: true,
      sortOrder: row.sort_order,
      orIndex: prev?.orIndex ?? Number.POSITIVE_INFINITY,
    })
  })

  return Array.from(merged.values())
    .sort((a, b) => {
      if (a.fromTable !== b.fromTable) return a.fromTable ? -1 : 1
      if (a.fromTable && b.fromTable) return a.sortOrder - b.sortOrder
      return a.orIndex - b.orIndex
    })
    .map((e) => e.raw)
}

export async function GET(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'GET, OPTIONS')

  const [openrouter, table] = await Promise.all([fetchOpenRouterCatalog(), fetchModelsTable()])
  const data = mergeCatalogs(openrouter, table)

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
  })
}
