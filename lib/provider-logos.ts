// Logo do autor do modelo (mesmo comportamento do desktop). No desktop as logos
// são resolvidas via import.meta.glob; no web elas vivem em `public/providers/
// <slug>.svg` e são servidas em `/providers/<slug>.svg`. O `slug` é o prefixo do
// id do modelo (ex.: "anthropic/claude-..." → "anthropic").

// Slugs com arquivo em public/providers/. Mantém o mesmo papel do `bySlug` do
// desktop: saber se existe logo dedicada (senão cai no _fallback).
const KNOWN = new Set<string>([
  'ai21', 'aionlabs-color', 'allenai', 'amazon', 'anthropic', 'arcee-ai',
  'baidu', 'bytedance-seed', 'bytedance', 'cohere', 'deepcogito', 'deepseek',
  'google', 'ibm-granite', 'inception', 'inflection', 'kwaipilot', 'liquid',
  'meta-llama', 'microsoft', 'minimax', 'mistralai', 'moonshotai', 'morph',
  'nousresearch', 'nvidia', 'openai', 'openrouter', 'perplexity', 'qwen',
  'relace', 'stepfun', 'tencent', 'upstage', 'x-ai', 'xiaomi', 'z-ai',
])

// Alguns autores têm slug diferente da marca; normaliza aqui quando preciso.
const ALIASES: Record<string, string> = {
  meta: 'meta-llama',
  llama: 'meta-llama',
  mistral: 'mistralai',
  moonshot: 'moonshotai',
  kimi: 'moonshotai',
  xai: 'x-ai',
  zai: 'z-ai',
  glm: 'z-ai',
  ibm: 'ibm-granite',
  granite: 'ibm-granite',
  alibaba: 'qwen',
}

function urlFor(slug: string): string | undefined {
  if (KNOWN.has(slug)) return `/providers/${slug}.svg`
  const alias = ALIASES[slug]
  if (alias && KNOWN.has(alias)) return `/providers/${alias}.svg`
  return undefined
}

// Autor a partir do id do modelo ("anthropic/claude-opus-4.8" → "anthropic").
// O catálogo prefixa aliases "latest" com "~" (ex.: "~anthropic/..."); remove.
export function authorSlug(modelId: string): string {
  return (modelId.replace(/^~/, '').split('/')[0] || '').toLowerCase()
}

// URL da logo do autor; cai no _fallback quando não houver.
export function providerLogo(slug: string): string {
  return urlFor(slug.toLowerCase()) ?? '/providers/_fallback.svg'
}

// Nome humano do provedor a partir do slug do autor (ex.: "openai" → "OpenAI").
// Usado no feed de notícias: os itens de "novo modelo" guardam o slug do autor
// em `source` (sem link para infra externa) e aqui rotulamos bonito no badge.
const PROVIDER_LABELS: Record<string, string> = {
  ai21: 'AI21',
  allenai: 'AllenAI',
  amazon: 'Amazon',
  anthropic: 'Anthropic',
  'arcee-ai': 'Arcee AI',
  baidu: 'Baidu',
  bytedance: 'ByteDance',
  'bytedance-seed': 'ByteDance',
  cohere: 'Cohere',
  deepcogito: 'DeepCogito',
  deepseek: 'DeepSeek',
  google: 'Google',
  'ibm-granite': 'IBM Granite',
  inception: 'Inception',
  inflection: 'Inflection',
  liquid: 'Liquid AI',
  'meta-llama': 'Meta',
  microsoft: 'Microsoft',
  minimax: 'MiniMax',
  mistralai: 'Mistral',
  moonshotai: 'Moonshot AI',
  morph: 'Morph',
  nousresearch: 'Nous Research',
  nvidia: 'NVIDIA',
  openai: 'OpenAI',
  perplexity: 'Perplexity',
  qwen: 'Qwen',
  stepfun: 'StepFun',
  tencent: 'Tencent',
  upstage: 'Upstage',
  'x-ai': 'xAI',
  xiaomi: 'Xiaomi',
  'z-ai': 'Z.AI',
}

export function providerLabel(slug: string): string {
  const s = slug.toLowerCase()
  if (PROVIDER_LABELS[s]) return PROVIDER_LABELS[s]
  const alias = ALIASES[s]
  if (alias && PROVIDER_LABELS[alias]) return PROVIDER_LABELS[alias]
  // Fallback: Title Case do próprio slug ("foo-bar" → "Foo Bar").
  return (
    s
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || slug
  )
}

// Logos monocromáticas (preto sobre transparente): ilegíveis no dark. Como são
// <img>, não herdam currentColor — invertemos a cor no dark (preto → branco).
const MONO_SLUGS = new Set([
  'anthropic', 'openai', 'x-ai', 'meta-llama', 'moonshotai', 'z-ai', 'openrouter',
  'xiaomi', 'amazon', 'ai21', 'relace', 'nousresearch', 'ibm-granite', 'inception',
  'liquid', 'inflection',
])
export function isMonochromeLogo(slug: string): boolean {
  const s = slug.toLowerCase()
  if (MONO_SLUGS.has(s)) return true
  // Sem logo dedicada → usa _fallback (monocromático) → inverte no dark.
  return !urlFor(s)
}
