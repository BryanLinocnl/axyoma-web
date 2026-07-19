'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Newspaper, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { providerLogo, providerLabel, isMonochromeLogo } from '@/lib/provider-logos'

type NewsRow = {
  id: string
  source: string | null
  title: string
  url: string | null
  summary: string | null
  image_url: string | null
  published_at: string | null
  created_at: string
}

type Lang = 'pt' | 'en'
type Translated = { title: string; summary: string | null }

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Só permitimos abrir links https (o agregador já sanitiza/allow-lista a origem;
// esta é uma checagem defensiva a mais no render).
function safeHref(url: string | null): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

// Itens de "novo modelo" são gravados sem link (url null) e guardam o SLUG do
// provedor em `source` (ex.: "anthropic"). Assim o card mostra a logo do provedor
// e um badge com o nome bonito — sem expor URL de infra externa no hover.
function isModelItem(it: NewsRow): boolean {
  return it.url === null && Boolean(it.source)
}

// Traduz título+resumo de todos os itens em UMA chamada ao proxy. Nunca lança
// para o chamador quebrar o feed — em falha, devolve o texto original.
async function translateItems(items: NewsRow[], target: Lang): Promise<Record<string, Translated>> {
  const texts: string[] = []
  for (const it of items) {
    texts.push(it.title)
    texts.push(it.summary ?? '')
  }
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target }),
  })
  if (!res.ok) throw new Error(`translate ${res.status}`)
  const data = (await res.json()) as { translations?: string[] }
  const t = data.translations ?? []
  const map: Record<string, Translated> = {}
  items.forEach((it, i) => {
    map[it.id] = {
      title: t[2 * i] || it.title,
      summary: it.summary ? t[2 * i + 1] || it.summary : null,
    }
  })
  return map
}

export function NewsFeed(): React.JSX.Element {
  const [items, setItems] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // App é PT-BR: idioma padrão do feed é Português (as fontes são em inglês).
  const [lang, setLang] = useState<Lang>('pt')
  const [ptCache, setPtCache] = useState<Record<string, Translated> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Lê direto via browser client — `model_news` tem RLS de SELECT liberada a
      // `authenticated`; não depende de service-role. Tabela vazia => estado
      // "nenhuma notícia" (não é erro).
      const { data, error: qErr } = await supabase
        .from('model_news')
        .select('id, source, title, url, summary, image_url, published_at, created_at')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(50)
      if (cancelled) return
      if (qErr) {
        setError('Falha ao carregar o feed.')
      } else {
        setItems((data as NewsRow[] | null) ?? [])
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Traduz uma vez por idioma. EN = original (sem chamada). PT = tradução cacheada
  // em estado. Falha → cache vazio (não re-tenta) e cai no texto original.
  useEffect(() => {
    if (lang !== 'pt' || items.length === 0 || ptCache) return
    let cancelled = false
    translateItems(items, 'pt')
      .then((map) => {
        if (!cancelled) setPtCache(map)
      })
      .catch(() => {
        if (!cancelled) setPtCache({}) // fallback silencioso: mantém originais
      })
    return () => {
      cancelled = true
    }
  }, [lang, items, ptCache])

  function viewOf(it: NewsRow): Translated {
    if (lang === 'pt' && ptCache && ptCache[it.id]) return ptCache[it.id]
    return { title: it.title, summary: it.summary }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
        {error}
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-12 text-center">
        <Newspaper className="text-muted-foreground size-6" />
        <p className="text-sm font-medium">Nenhuma notícia ainda</p>
        <p className="text-muted-foreground max-w-sm text-xs">
          O agregador roda diariamente e reúne novidades sobre modelos das principais fontes. Volte em breve.
        </p>
      </Card>
    )
  }

  // Enquanto o PT está selecionado e a tradução ainda não chegou (ptCache null),
  // mostramos o indicador. Ao resolver (mesmo cache vazio) o indicador some.
  const isTranslatingNow = lang === 'pt' && items.length > 0 && !ptCache

  return (
    <div className="space-y-3">
      {/* Barra: seletor de idioma + estado de tradução */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {isTranslatingNow && (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Traduzindo…</span>
            </>
          )}
        </div>
        <div
          role="tablist"
          aria-label="Idioma do feed"
          className="bg-muted/60 inline-flex items-center gap-0.5 rounded-lg border p-0.5"
        >
          {(
            [
              { key: 'pt', label: 'Português' },
              { key: 'en', label: 'English' },
            ] as const
          ).map((opt) => {
            const active = lang === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLang(opt.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {items.map((it) => {
        const href = safeHref(it.url)
        const view = viewOf(it)
        const modelItem = isModelItem(it)
        const authorSlugValue = it.source ?? ''
        const badgeText = modelItem ? providerLabel(authorSlugValue) : it.source

        return (
          <Card key={it.id} className="overflow-hidden p-0">
            <div className="flex gap-4 p-4">
              {/* Visual do card: imagem do feed → logo do provedor → ícone genérico */}
              {it.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- feed externo; sem otimização do next/image
                <img
                  src={it.image_url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="hidden size-20 shrink-0 rounded-lg border object-cover sm:block"
                />
              ) : modelItem ? (
                <div className="bg-background hidden size-20 shrink-0 items-center justify-center rounded-lg border sm:flex">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático em /public */}
                  <img
                    src={providerLogo(authorSlugValue)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className={cn('size-10 object-contain', isMonochromeLogo(authorSlugValue) && 'dark:invert')}
                  />
                </div>
              ) : (
                <div className="bg-muted/40 text-muted-foreground hidden size-20 shrink-0 items-center justify-center rounded-lg border sm:flex">
                  <Newspaper className="size-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {badgeText && <Badge variant="secondary">{badgeText}</Badge>}
                  <span className="text-muted-foreground text-xs">{fmtDate(it.published_at ?? it.created_at)}</span>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-start gap-1.5 text-sm font-semibold hover:underline"
                  >
                    {view.title}
                    <ExternalLink className="text-muted-foreground mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                ) : (
                  <p className="text-sm font-semibold">{view.title}</p>
                )}
                {view.summary && <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{view.summary}</p>}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
