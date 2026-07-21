// Catálogo público de modelos (mesma forma de dados do app desktop). O catálogo
// é servido pela rota interna `/api/v1/models` — um proxy do catálogo público
// (sem chave, sem login). A SELEÇÃO do usuário (ligar/desligar) mora na tabela
// `model_selection` sob RLS e é tratada no componente, não aqui.
//
// Porte 1:1 de `src/renderer/src/lib/openrouter-catalog.ts` do desktop: mesma
// forma de `CatalogModel`, mesma extração de campos, mesma ordenação por
// relevância, mesmas capacidades/tipos e formatação de contexto. A única
// diferença é a origem do fetch (proxy interno em vez do endpoint externo).

export interface CatalogModel {
  id: string // ex.: "anthropic/claude-opus-4.8"
  name: string
  contextLength: number
  promptPrice: number
  completionPrice: number
  inputModalities: string[] // ex.: ["text","image"]
  outputModalities: string[] // ex.: ["text"]
  supportedParameters: string[] // ex.: ["tools","reasoning",...]
  paramSize?: string // "32B" quando dá pra inferir do nome
  // Teto de imagens de referência (img2img) do modelo — só vem da tabela
  // `public.models`. Ausente (OpenRouter) → o consumidor aplica fallback (4).
  maxReferenceImages?: number
}

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
  max_reference_images?: number
}

// "Qwen3 32B", "Llama 405B", "GLM 4.6 355B-A32B" → "32B"/"405B"/"355B".
function parseParamSize(name: string): string | undefined {
  const m = name.match(/\b(\d+(?:\.\d+)?)\s*b\b/i)
  return m ? `${m[1]}B` : undefined
}

// Origem no web: proxy interno (mesma origem, sem CORS, chave fica no servidor).
const CATALOG_URL = '/api/v1/models'

export async function fetchCatalog(): Promise<CatalogModel[]> {
  const res = await fetch(CATALOG_URL)
  if (!res.ok) throw new Error(`Catálogo HTTP ${res.status}`)
  const json = (await res.json()) as { data?: RawModel[] }
  const list = (json.data ?? [])
    // Oculta os meta-modelos de roteamento cujo namespace é o do provedor de
    // infra (ex.: "openrouter/auto") — não expor esse nome na UI.
    .filter((m) => !m.id.toLowerCase().startsWith('openrouter/'))
    .map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    contextLength: m.context_length ?? 0,
    promptPrice: Number(m.pricing?.prompt ?? 0),
    completionPrice: Number(m.pricing?.completion ?? 0),
    inputModalities: m.architecture?.input_modalities ?? [],
    outputModalities: m.architecture?.output_modalities ?? [],
    supportedParameters: m.supported_parameters ?? [],
    paramSize: parseParamSize(m.name ?? ''),
    maxReferenceImages: m.max_reference_images,
  }))
  list.sort(byRelevance)
  return list
}

// ── Relevância ────────────────────────────────────────────────────────────────
// Autores flagship primeiro; aliases "~...latest" e autores desconhecidos por
// último. Dentro do mesmo autor: MAIOR contexto primeiro, depois mais caro
// (proxy de capacidade), depois nome. Assim modelos grandes (ex.: Fable 5, Opus)
// ficam à frente de mini/haiku.
const AUTHOR_RANK = [
  'anthropic', 'openai', 'google', 'x-ai', 'deepseek', 'qwen', 'meta-llama',
  'mistralai', 'moonshotai', 'z-ai', 'minimax', 'cohere', 'nvidia',
]
function relevanceScore(m: CatalogModel): number {
  const slug = m.id.replace(/^~/, '').split('/')[0]?.toLowerCase() ?? ''
  const rank = AUTHOR_RANK.indexOf(slug)
  const base = rank === -1 ? AUTHOR_RANK.length : rank
  const aliasPenalty = m.id.startsWith('~') ? 100 : 0
  return base + aliasPenalty
}
function byRelevance(a: CatalogModel, b: CatalogModel): number {
  const r = relevanceScore(a) - relevanceScore(b)
  if (r !== 0) return r
  if (a.contextLength !== b.contextLength) return b.contextLength - a.contextLength
  if (a.completionPrice !== b.completionPrice) return b.completionPrice - a.completionPrice
  return a.name.localeCompare(b.name)
}

// ── Capacidades (badges do card) ──────────────────────────────────────────────
export function modelCapabilities(m: CatalogModel): string[] {
  const caps: string[] = []
  const params = m.supportedParameters
  if (params.includes('tools') || params.includes('tool_choice')) caps.push('Tools')
  if (m.inputModalities.includes('image')) caps.push('Vision')
  if (m.inputModalities.includes('audio')) caps.push('Áudio-in')
  if (m.outputModalities.includes('image')) caps.push('Imagem')
  if (m.outputModalities.includes('audio')) caps.push('Áudio')
  if (params.includes('reasoning') || params.includes('include_reasoning')) caps.push('Reasoning')
  if (params.includes('structured_outputs') || params.includes('response_format')) caps.push('JSON')
  return caps
}

// ── Filtros por tipo ──────────────────────────────────────────────────────────
export interface ModelType {
  key: string
  label: string
  match: (m: CatalogModel) => boolean
}
const hay = (m: CatalogModel): string => `${m.id} ${m.name}`.toLowerCase()
// Imagem/Áudio/Vídeo = o que o modelo GERA (output). Vision = o que ele ENXERGA
// (input de imagem). Transcription = ouve áudio (input) e devolve texto.
export const MODEL_TYPES: ModelType[] = [
  { key: 'text', label: 'Texto', match: (m) => m.outputModalities.includes('text') },
  // Aproxima "modelo de código": LLM de texto com tools (usável como agente de
  // código) OU coder/codex explícito. Inclui Claude/GPT/Gemini/Qwen/DeepSeek,
  // exclui imagem/áudio/embeddings.
  {
    key: 'code',
    label: 'Código',
    match: (m) =>
      m.outputModalities.includes('text') &&
      (m.supportedParameters.includes('tools') ||
        m.supportedParameters.includes('tool_choice') ||
        /cod(e|er|ing)|codex/.test(hay(m))),
  },
  { key: 'vision', label: 'Vision', match: (m) => m.inputModalities.includes('image') },
  { key: 'image', label: 'Imagem', match: (m) => m.outputModalities.includes('image') },
  { key: 'audio', label: 'Áudio', match: (m) => m.outputModalities.includes('audio') },
  { key: 'video', label: 'Vídeo', match: (m) => m.outputModalities.includes('video') },
  { key: 'speech', label: 'Speech', match: (m) => m.outputModalities.includes('audio') && /(tts|text-to-speech|\bspeech\b)/.test(hay(m)) },
  { key: 'transcription', label: 'Transcription', match: (m) => m.inputModalities.includes('audio') || /(whisper|transcri|speech-to-text|\bstt\b)/.test(hay(m)) },
  { key: 'embeddings', label: 'Embeddings', match: (m) => /embed/.test(hay(m)) },
]

// "Anthropic: Claude Opus 4.8" → "Claude Opus 4.8".
export function stripAuthorFromName(name: string): string {
  const i = name.indexOf(':')
  return i >= 0 ? name.slice(i + 1).trim() : name
}

// 1048576 → "1M", 262144 → "256K".
export function formatContext(n: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_048_576).toFixed(n % 1_048_576 === 0 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1024)}K`
  return String(n)
}
