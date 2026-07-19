// =============================================================================
// Agregador do feed de modelos (P3B). Roda por CRON (Vercel) e faz UPSERT em
// `model_news` usando a service-role key (server-only). NUNCA é chamado pelo
// browser: é protegido por CRON_SECRET.
//
// Segurança / sanitização:
//   * ALLOW-LIST de domínios: só buscamos das fontes fixas abaixo e só gravamos
//     itens cujo link pertença a um host da allow-list (bloqueia injeção de
//     domínio malicioso por um feed comprometido).
//   * Armazenamos SOMENTE texto puro (title/summary) — todo HTML é removido e as
//     entidades decodificadas. Nunca gravamos HTML cru (evita XSS no render).
//   * image_url só é aceita se for https (evita mixed-content / esquemas exóticos).
//   * Dedupe por `url` (SELECT-then-filter — a tabela não tem unique em url).
//   * Escrita só com service-role; a RLS + REVOKE já bloqueiam anon/authenticated.
//
// Auth do cron: header `Authorization: Bearer <CRON_SECRET>` (a Vercel injeta
// isso automaticamente nos cron jobs quando a env CRON_SECRET está setada).
// =============================================================================

import { checkRateLimit } from '@/lib/supabase-admin'

export const runtime = 'edge'

// Guarda de abuso: mesmo protegido por CRON_SECRET, limitamos disparos manuais
// para não martelar as fontes externas / a OpenRouter. Chave global (a rota não
// é por-usuário). NIL uuid como "usuário" sintético no contador.
const REFRESH_USER = '00000000-0000-0000-0000-000000000000'
const REFRESH_LIMIT = Number(process.env.NEWS_REFRESH_LIMIT ?? 6)
const REFRESH_WINDOW_S = Number(process.env.NEWS_REFRESH_WINDOW_S ?? 3600)

// -----------------------------------------------------------------------------
// Fontes (allow-list). RSS 2.0 / Atom de portais reputáveis + delta de modelos
// da OpenRouter. Cada host aqui também entra na allow-list de LINKS aceitos.
// -----------------------------------------------------------------------------
const RSS_SOURCES: { source: string; feed: string }[] = [
  { source: 'Hugging Face', feed: 'https://huggingface.co/blog/feed.xml' },
  { source: 'The Verge AI', feed: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { source: 'VentureBeat AI', feed: 'https://venturebeat.com/category/ai/feed/' },
  { source: 'Ars Technica AI', feed: 'https://arstechnica.com/ai/feed/' },
]

// Apex hosts permitidos para links gravados (host === apex ou *.apex).
const ALLOWED_LINK_APEXES = [
  'huggingface.co',
  'theverge.com',
  'venturebeat.com',
  'arstechnica.com',
]

const OPENROUTER_MODELS = 'https://openrouter.ai/api/v1/models'
const MODEL_DELTA_WINDOW_DAYS = 21
const MODEL_DELTA_LIMIT = 15
const SUMMARY_MAX = 400

type NewsItem = {
  source: string
  title: string
  url: string | null // RSS: link externo real. Modelo-delta: null (sem link de infra).
  summary: string | null
  image_url: string | null
  published_at: string | null
}

// Chave de dedupe: itens com link deduplicam por URL; itens sem link
// (modelo-delta) deduplicam por source+title (separador seguro entre campos).
function dedupeKey(source: string, title: string, url: string | null): string {
  return url ?? `${source}\n${title}`
}

// -----------------------------------------------------------------------------
// Sanitização
// -----------------------------------------------------------------------------
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

function toPlainText(raw: string | null | undefined): string {
  if (!raw) return ''
  const noTags = raw.replace(/<[^>]*>/g, ' ')
  return decodeEntities(noTags).replace(/\s+/g, ' ').trim()
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase()
  return ALLOWED_LINK_APEXES.some((apex) => h === apex || h.endsWith(`.${apex}`))
}

function sanitizeUrl(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const parsed = new URL(u.trim())
    if (parsed.protocol !== 'https:') return null
    if (!hostAllowed(parsed.host)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function sanitizeImage(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const parsed = new URL(u.trim())
    // Só https; sem exigir a mesma allow-list dos links (imagens de CDN variam),
    // mas nunca http/data/javascript.
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// Parser RSS/Atom mínimo (edge não tem DOMParser). Extração por regex das tags
// conhecidas; suficiente para feeds RSS 2.0 e Atom bem-formados dos portais.
// -----------------------------------------------------------------------------
function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = re.exec(block)
  return m ? stripCdata(m[1]).trim() : null
}

function atomLink(block: string): string | null {
  // <link rel="alternate" href="..."/> ou <link href="..."/>
  const alt = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block)
  if (alt) return alt[1]
  const any = /<link[^>]*href=["']([^"']+)["']/i.exec(block)
  return any ? any[1] : null
}

function firstImage(block: string): string | null {
  const media = /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i.exec(block)
  if (media) return media[1]
  const enc = /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i.exec(block)
  if (enc) return enc[1]
  const imgTag = /<img[^>]*src=["']([^"']+)["']/i.exec(block)
  return imgTag ? imgTag[1] : null
}

function parseDate(s: string | null): string | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const isAtom = /<entry[\s>]/i.test(xml)
  const blocks = xml.match(isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi) ?? []

  for (const block of blocks) {
    const rawTitle = tagContent(block, 'title')
    const link = isAtom ? atomLink(block) : tagContent(block, 'link')
    const rawSummary =
      tagContent(block, 'description') ??
      tagContent(block, 'summary') ??
      tagContent(block, 'content:encoded') ??
      tagContent(block, 'content')
    const rawDate = isAtom
      ? tagContent(block, 'updated') ?? tagContent(block, 'published')
      : tagContent(block, 'pubDate')

    const title = truncate(toPlainText(rawTitle), 200)
    const url = sanitizeUrl(link)
    if (!title || !url) continue // sem título ou fora da allow-list → descarta

    const summaryText = toPlainText(rawSummary)
    items.push({
      source,
      title,
      url,
      summary: summaryText ? truncate(summaryText, SUMMARY_MAX) : null,
      image_url: sanitizeImage(firstImage(block)),
      published_at: parseDate(rawDate),
    })
  }
  return items
}

// -----------------------------------------------------------------------------
// Delta de modelos da OpenRouter: modelos criados nos últimos N dias.
// -----------------------------------------------------------------------------
type OpenRouterModel = { id: string; name?: string; description?: string; created?: number }

async function fetchModelDelta(): Promise<NewsItem[]> {
  const key = process.env.OPENROUTER_KEY
  const res = await fetch(OPENROUTER_MODELS, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })
  if (!res.ok) throw new Error(`openrouter ${res.status}`)
  const json = (await res.json()) as { data?: OpenRouterModel[] }
  const models = json.data ?? []
  const cutoff = Date.now() - MODEL_DELTA_WINDOW_DAYS * 864e5

  return models
    .filter((m) => typeof m.created === 'number' && m.created * 1000 >= cutoff)
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .slice(0, MODEL_DELTA_LIMIT)
    .map((m): NewsItem | null => {
      // Slug do autor a partir do id do modelo ("anthropic/claude-..." → "anthropic").
      // Guardamos ESSE slug em `source` (o feed rotula bonito e resolve a logo do
      // provedor a partir dele). NÃO gravamos link de infra externa: url = null.
      const author = (m.id.split('/')[0] || '').toLowerCase()
      if (!author) return null
      return {
        source: author,
        title: truncate(`Novo modelo: ${toPlainText(m.name) || m.id}`, 200),
        url: null,
        summary: m.description ? truncate(toPlainText(m.description), SUMMARY_MAX) : null,
        image_url: null,
        published_at: m.created ? new Date(m.created * 1000).toISOString() : null,
      }
    })
    .filter((x): x is NewsItem => x !== null)
}

// -----------------------------------------------------------------------------
// Service-role writes (server-only; nunca expor ao browser).
// -----------------------------------------------------------------------------
async function existingKeys(baseUrl: string, key: string): Promise<Set<string>> {
  // Buscamos url+source+title para dedupar TANTO itens com link (por url) quanto
  // itens de modelo-delta (url null → chave source+title).
  const res = await fetch(
    `${baseUrl}/rest/v1/model_news?select=url,source,title&order=created_at.desc&limit=500`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) return new Set()
  const rows = (await res.json()) as { url: string | null; source: string | null; title: string }[]
  return new Set(rows.map((r) => dedupeKey(r.source ?? '', r.title, r.url)))
}

async function insertRows(baseUrl: string, key: string, rows: NewsItem[]): Promise<void> {
  if (rows.length === 0) return
  const res = await fetch(`${baseUrl}/rest/v1/model_news`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`insert model_news falhou (${res.status}): ${detail}`)
  }
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sem segredo configurado → nunca autoriza
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  if (req.headers.get('x-cron-secret') === secret) return true
  return false
}

async function handleRefresh(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: { message: 'não autorizado' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit global (custo/abuso). Fail-open se a RPC não existir.
  const rl = await checkRateLimit({
    userId: REFRESH_USER,
    bucket: 'news_refresh',
    limit: REFRESH_LIMIT,
    windowSeconds: REFRESH_WINDOW_S,
  })
  if (!rl.allowed) {
    const retry = rl.resetAt ? Math.max(1, Math.ceil((Date.parse(rl.resetAt) - Date.now()) / 1000)) : REFRESH_WINDOW_S
    return new Response(JSON.stringify({ error: { message: 'refresh muito frequente' } }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retry) },
    })
  }

  const baseUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !key) {
    return new Response(JSON.stringify({ error: { message: 'SUPABASE_URL/SERVICE_ROLE ausentes' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const perSource: Record<string, number> = {}
  const collected: NewsItem[] = []

  // Delta de modelos
  try {
    const delta = await fetchModelDelta()
    perSource['OpenRouter'] = delta.length
    collected.push(...delta)
  } catch {
    perSource['OpenRouter'] = -1 // falhou; não derruba o resto
  }

  // Feeds RSS/Atom — cada um isolado em try/catch.
  for (const src of RSS_SOURCES) {
    try {
      const res = await fetch(src.feed, { headers: { 'User-Agent': 'AxyomaNewsBot/1.0' } })
      if (!res.ok) throw new Error(`${res.status}`)
      const xml = await res.text()
      const items = parseFeed(xml, src.source)
      perSource[src.source] = items.length
      collected.push(...items)
    } catch {
      perSource[src.source] = -1
    }
  }

  // Dedupe: contra o banco + dentro do próprio lote.
  const known = await existingKeys(baseUrl, key)
  const seen = new Set<string>()
  const fresh: NewsItem[] = []
  for (const item of collected) {
    const k = dedupeKey(item.source, item.title, item.url)
    if (known.has(k) || seen.has(k)) continue
    seen.add(k)
    fresh.push(item)
  }

  try {
    await insertRows(baseUrl, key, fresh)
  } catch (e) {
    return new Response(
      JSON.stringify({ error: { message: e instanceof Error ? e.message : 'insert falhou' }, perSource }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ ok: true, inserted: fresh.length, scanned: collected.length, perSource }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

// A Vercel dispara crons via GET; expomos POST também para trigger manual.
export async function GET(req: Request): Promise<Response> {
  return handleRefresh(req)
}
export async function POST(req: Request): Promise<Response> {
  return handleRefresh(req)
}
