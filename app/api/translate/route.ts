// =============================================================================
// Proxy de tradução (server-only) para o feed de Notícias. O browser NÃO pode
// chamar o endpoint do Google Translate direto (CORS); então proxiamos aqui.
//
// Contrato:
//   POST { texts: string[], target: 'pt' | 'en' }
//   → { translations: string[] }  (mesma ordem/comprimento de `texts`)
//
// Resiliência (regra dura: NUNCA quebrar o feed):
//   * Cada texto é traduzido isolado; falha/timeout de um → devolve o ORIGINAL.
//   * Timeout curto por request (AbortController).
//   * Cap de tamanho por texto e de quantidade por lote.
//   * Endpoint NÃO-oficial do Google (translate_a/single, client=gtx). Sem chave.
//     Pode mudar/limitar sem aviso — por isso o fallback é sempre o original.
// =============================================================================

export const runtime = 'edge'

const MAX_TEXTS = 80 // itens * 2 (title+summary) — 50 notícias cabem folgado
const MAX_LEN = 1200 // por texto; títulos/resumos do feed são curtos
const PER_TEXT_TIMEOUT_MS = 4000

type Target = 'pt' | 'en'

function isTarget(v: unknown): v is Target {
  return v === 'pt' || v === 'en'
}

// Resposta do translate_a/single: array aninhado; os segmentos traduzidos ficam
// em json[0][i][0]. Concatenamos todos os segmentos preservando a quebra.
function extractTranslation(json: unknown): string | null {
  if (!Array.isArray(json)) return null
  const segments = json[0]
  if (!Array.isArray(segments)) return null
  let out = ''
  for (const seg of segments) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0]
  }
  return out.length > 0 ? out : null
}

async function translateOne(text: string, target: Target): Promise<string> {
  const trimmed = text.slice(0, MAX_LEN)
  if (!trimmed.trim()) return text

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PER_TEXT_TIMEOUT_MS)
  try {
    const endpoint =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(endpoint, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!res.ok) return text
    const json = await res.json()
    return extractTranslation(json) ?? text
  } catch {
    return text // qualquer falha (rede/timeout/parse) → original
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: { message: 'body inválido' } }, 400)
  }

  const b = body as { texts?: unknown; target?: unknown }
  if (!Array.isArray(b.texts) || !isTarget(b.target)) {
    return json({ error: { message: 'parâmetros inválidos' } }, 400)
  }

  const texts = b.texts.slice(0, MAX_TEXTS).map((t) => (typeof t === 'string' ? t : ''))
  const target = b.target

  // Traduz em paralelo; cada um é à prova de falha (devolve o original).
  const translations = await Promise.all(texts.map((t) => translateOne(t, target)))

  return json(
    { translations },
    200,
    // Cacheável no edge: o mesmo lote de notícias reusa a tradução por um tempo.
    'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
  )
}

function json(payload: unknown, status: number, cache?: string): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cache) headers['Cache-Control'] = cache
  return new Response(JSON.stringify(payload), { status, headers })
}
