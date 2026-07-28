import { corsHeaders } from '@/lib/cors'
import { verifyUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/supabase-admin'

// Catálogo de modelos, PARAMETRIZADO POR FONTE (`?source=`).
//
//   • source=axyoma (default) — o merge descrito abaixo. É TUDO o que os
//     créditos AXYOMA cobrem: `public.models` é overlay de roteamento/preço, não
//     allow-list; o que não está na tabela cai no fallback OpenRouter com a
//     NOSSA chave e debita crédito igual (ver chat/completions/route.ts).
//   • source=openrouter — catálogo público CRU da OpenRouter, para quem usa a
//     PRÓPRIA chave. Aqui NÃO tiramos os modelos que também estão na tabela: a
//     chave do usuário atende esses modelos tanto quanto a nossa. Esconder um
//     Gemini desta lista só porque ele também é vendido por nós seria decidir
//     pelo usuário de que bolso ele paga.
//
// Não há dedup ENTRE fontes — é de propósito. O mesmo modelo aparecer nas duas
// listas é a informação, não o defeito: cada uma cobra de um lugar diferente.
//
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
// EXIGE LOGIN (auditoria A-3). Antes era aberta, com o argumento de que catálogo
// é dado público — mas a resposta carrega `input_price_usd_per_mtok` e
// `output_price_usd_per_mtok` da NOSSA tabela, exatamente as colunas que a
// migration 0025 tirou do alcance da chave anon. Deixar a rota aberta mantinha a
// janela ao lado da porta que acabara de ser trancada. Também era a única rota
// sem auth e sem rate limit que dispara duas chamadas externas (OpenRouter +
// Supabase) por request — martelar isso queima invocação na nossa conta.
//
// Os dois clientes (desktop e site) só montam catálogo depois do login, então
// exigir o JWT não muda fluxo nenhum.
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
  // Níveis de esforço de raciocínio aceitos, em ordem crescente. Ausente = o
  // cliente usa o padrão low/medium/high. Só vem preenchido para o modelo que
  // foge da regra (ex.: gpt-5.2-pro recusa 'low'; Gemini só aceita low/high).
  reasoning_levels?: string[]
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
  reasoning_levels: string[] | null
}

const MODELS_TABLE_SELECT =
  'id,display_name,context_length,input_modalities,output_modalities,supported_parameters,input_price_usd_per_mtok,output_price_usd_per_mtok,sort_order,max_reference_images,reasoning_levels'

// `public.byok_models` — catálogo dos provedores em que a chave é DO USUÁRIO.
//
// Tabela separada de `public.models` de propósito. As duas descrevem modelos,
// mas respondem perguntas diferentes:
//
//   • `models`      → o que NÓS servimos. Carrega roteamento (`upstream_model_id`,
//                     `region`, `vertex_publisher`) e o preço que entra na NOSSA
//                     margem. Mexer nela mexe em cobrança.
//   • `byok_models` → só descrição de catálogo. Não roteia nada e o preço é o
//                     PÚBLICO do fornecedor, usado apenas para estimar custo na
//                     tela. Ninguém é cobrado por nós aqui.
//
// Juntar as duas obrigaria a filtrar por `provider` em todo lugar que hoje lê a
// tabela inteira — e esquecer um filtro colocaria um GPT na lista de créditos
// AXYOMA, onde ele falharia por não existir chave da OpenAI no servidor.
interface ByokModelRow {
  id: string
  provider: string
  display_name: string
  context_length: number
  input_modalities: string[]
  output_modalities: string[]
  supported_parameters: string[]
  input_price_usd_per_mtok: number | string
  output_price_usd_per_mtok: number | string
  sort_order: number
  reasoning_levels: string[] | null
}

const BYOK_MODELS_SELECT =
  'id,provider,display_name,context_length,input_modalities,output_modalities,supported_parameters,input_price_usd_per_mtok,output_price_usd_per_mtok,sort_order,reasoning_levels'

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

// Busca o catálogo BYOK de UMA fonte. Falha -> [] (degrada com graça: o app
// mostra "nenhum modelo" em vez de um catálogo pela metade).
async function fetchByokModels(provider: string): Promise<ByokModelRow[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('SUPABASE_URL/SERVICE_ROLE_KEY ausentes — catálogo BYOK indisponível')
    return []
  }
  try {
    const qs = new URLSearchParams({
      select: BYOK_MODELS_SELECT,
      provider: `eq.${provider}`,
      enabled: 'eq.true',
      order: 'sort_order.asc',
    })
    const res = await fetch(`${SUPABASE_URL}/rest/v1/byok_models?${qs.toString()}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    })
    if (!res.ok) {
      console.error(`byok_models select falhou (${res.status}): ${await res.text().catch(() => '')}`)
      return []
    }
    return (await res.json()) as ByokModelRow[]
  } catch (e) {
    console.error('byok_models indisponível:', (e as Error).message)
    return []
  }
}

function byokRowToRawModel(row: ByokModelRow): RawModel {
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
    reasoning_levels: row.reasoning_levels ?? undefined,
  }
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
    reasoning_levels: row.reasoning_levels ?? undefined,
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
  const fail = (status: number, message: string, type: string): Response =>
    new Response(JSON.stringify({ error: { message, type } }), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return fail(401, 'não autenticado', 'auth')
  }

  // Limite folgado: o catálogo é cacheado no cliente, mas várias telas o pedem.
  // Fail-closed como as demais rotas que custam chamada externa.
  const rl = await checkRateLimit({
    userId,
    bucket: 'models',
    limit: Number(process.env.MODELS_RATE_LIMIT ?? 60),
    windowSeconds: 60,
  })
  if (!rl.allowed) return fail(429, 'muitas consultas — tente em instantes', 'rate_limit')

  // Fonte pedida. Desconhecida → `axyoma` (o comportamento de sempre): um
  // parâmetro errado não pode virar catálogo vazio no cliente.
  const pedida = new URL(req.url).searchParams.get('source')
  const source: 'axyoma' | 'openrouter' | 'openai' =
    pedida === 'openrouter' ? 'openrouter' : pedida === 'openai' ? 'openai' : 'axyoma'

  // `openai` sai por um caminho próprio: não consulta a OpenRouter (o catálogo
  // dela não lista modelos da OpenAI sob os ids que a API da OpenAI usa —
  // `gpt-5`, não `openai/gpt-5`) nem `public.models` (que é a nossa curadoria de
  // roteamento e cobrança, e aqui não cobramos nada).
  //
  // A curadoria vem de `byok_models` porque o `/v1/models` da OpenAI devolve
  // apenas `id`, `object`, `created` e `owned_by` — sem preço, sem janela de
  // contexto, sem capacidades. Uma busca ao vivo daria uma lista de ids que o
  // app não sabe precificar nem filtrar por suporte a tools/visão. Em tabela,
  // preço se corrige sem release, o que importa num catálogo que muda sozinho.
  if (source === 'openai') {
    // Sem merge e sem fallback: aqui a tabela é a allow-list, não overlay. Zero
    // linhas devolve lista vazia de propósito — melhor "nenhum modelo" do que um
    // catálogo que a chave do usuário pode não atender.
    const byok = await fetchByokModels('openai')
    return new Response(JSON.stringify({ data: byok.map(byokRowToRawModel) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300', ...CORS },
    })
  }

  // `openrouter` não precisa da tabela: aquela lista é o catálogo do fornecedor,
  // sem a nossa curadoria (e sem os nossos preços, que ali não se aplicam — quem
  // paga é a chave do usuário).
  const [openrouter, table] = await Promise.all([
    fetchOpenRouterCatalog(),
    source === 'axyoma' ? fetchModelsTable() : Promise.resolve([] as ModelsTableRow[]),
  ])
  const data = source === 'axyoma' ? mergeCatalogs(openrouter, table) : openrouter

  return new Response(JSON.stringify({ data }), {
    status: 200,
    // `private`: a resposta agora vem de rota autenticada — não pode ficar em
    // cache compartilhado da CDN.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300', ...CORS },
  })
}
