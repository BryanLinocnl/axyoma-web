'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, RotateCw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { providerLogo, authorSlug, isMonochromeLogo } from '@/lib/provider-logos'
import {
  fetchCatalog,
  stripAuthorFromName,
  formatContext,
  modelCapabilities,
  MODEL_TYPES,
  type CatalogModel,
} from '@/lib/openrouter-catalog'

// =============================================================================
// CONTRATO da tabela `model_selection` (sincronizada com o Axyoma IA Code):
//   user_id    uuid        — dono (auth.uid()); a RLS restringe a linha ao usuário
//   model_id   text        — id do modelo no catálogo (ex.: "openai/gpt-4o")
//   enabled    boolean     — true = o usuário quer o modelo ativo no desktop
//   updated_at timestamptz — carimbo do último toggle
//   PK (user_id, model_id)
//
// O WEB SÓ ESCREVE preferência NÃO-EXECUTÁVEL (id do modelo + enabled). NUNCA
// grava comandos, caminhos, scripts ou qualquer campo interpretável como ação.
// O app desktop assina `postgres_changes` desta tabela (Supabase Realtime, sob
// a RLS do JWT do dono), valida o `model_id` contra o catálogo e aplica LOCAL —
// não existe canal de execução remota web→máquina.
//
// UI/LÓGICA: porte 1:1 do seletor do desktop (ModelGrid). A ÚNICA diferença é
// que "ativo" aqui = linha em `model_selection` com enabled=true (em vez da
// lista local do desktop), e o toggle faz upsert nessa tabela (otimista, reverte
// no erro). O desktop reflete a mudança via Realtime.
// =============================================================================

// Grid de modelos: vertical, 3 colunas, sem scroll interno nem paginação — o
// catálogo filtrado renderiza inteiro (a página rola) pra busca e filtros
// refletirem tudo. Logos com loading lazy seguram o custo. Card com logo do
// autor, nome, autor · tamanho · contexto, capacidades e switch. "Ativo" = o
// modelo tem linha enabled=true em model_selection.
export function ModelsCatalog({ userId }: { userId: string }): React.JSX.Element {
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [selection, setSelection] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchCatalog()
      .then((list) => setCatalog(list))
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar modelos.'))
      .finally(() => setLoading(false))
  }

  // Catálogo PÚBLICO (não depende de login) + seleção do usuário (via sessão
  // Supabase/RLS, só se logado). Um não bloqueia o outro: a lista aparece mesmo
  // que a seleção falhe/esteja vazia. Todo setState acontece após um await, para
  // não disparar render em cascata dentro do efeito.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchCatalog()
        if (!cancelled) {
          setCatalog(list)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar modelos.')
      } finally {
        if (!cancelled) setLoading(false)
      }

      if (cancelled || !userId) return
      const { data } = await supabase
        .from('model_selection')
        .select('model_id, enabled')
        .eq('user_id', userId)
      if (cancelled) return
      const sel = new Map<string, boolean>()
      for (const row of (data as { model_id: string; enabled: boolean }[] | null) ?? []) {
        sel.set(row.model_id, row.enabled)
      }
      setSelection(sel)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // VIA DE MÃO DUPLA (app → web ao vivo): assina Realtime em model_selection do
  // usuário. Quando o desktop (ou outra aba) muda a seleção, refletimos aqui sem
  // reload. Nossa própria escrita também ecoa aqui, mas é idempotente (mesmo
  // valor que o update otimista já colocou).
  useEffect(() => {
    if (!userId) return
    // O client autenticado já coloca o JWT no socket do Realtime (supabase-js faz
    // isso no sign-in/refresh), então a RLS vale sem setAuth manual. Cria o canal
    // e assina de forma SÍNCRONA para o cleanup capturar a referência e removê-la
    // — evita reusar um canal já subscrito (que dispara
    // "cannot add postgres_changes callbacks after subscribe()").
    const channel = supabase
      .channel(`model-selection-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'model_selection', filter: `user_id=eq.${userId}` },
        (payload) => {
          setSelection((prev) => {
            const next = new Map(prev)
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { model_id?: string }
              if (old.model_id) next.delete(old.model_id)
            } else {
              const row = payload.new as { model_id: string; enabled: boolean }
              next.set(row.model_id, Boolean(row.enabled))
            }
            return next
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  // Ids ativos = linhas enabled=true (mesmo papel do `enabledIds` do desktop).
  const enabledIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, on] of selection) if (on) s.add(id)
    return s
  }, [selection])

  // Modelos ativos (para os chips do topo). Preserva a ordem por relevância do
  // catálogo; ids ativos fora do catálogo atual são ignorados nos chips.
  const enabledModels = useMemo(
    () => catalog.filter((m) => enabledIds.has(m.id)),
    [catalog, enabledIds],
  )

  // Só mostra os filtros de tipo que têm ao menos 1 modelo no catálogo.
  const availableTypes = useMemo(
    () => MODEL_TYPES.filter((t) => catalog.some((m) => t.match(m))),
    [catalog],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const typeDef = type ? MODEL_TYPES.find((t) => t.key === type) : null
    return catalog.filter((m) => {
      if (typeDef && !typeDef.match(m)) return false
      if (!q) return true
      return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    })
  }, [catalog, query, type])

  const onLogoError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = providerLogo('')
  }

  // Toggle otimista: reflete já na UI e faz upsert em model_selection; reverte a
  // UI se o upsert falhar. É o único ponto de escrita no banco.
  const setEnabled = async (modelId: string, next: boolean): Promise<void> => {
    setSelection((prev) => new Map(prev).set(modelId, next))
    setSaving((prev) => new Set(prev).add(modelId))
    const { error: upErr } = await supabase.from('model_selection').upsert(
      { user_id: userId, model_id: modelId, enabled: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,model_id' },
    )
    if (upErr) {
      setSelection((prev) => new Map(prev).set(modelId, !next))
      setError('Não foi possível salvar a seleção. Tente novamente.')
    }
    setSaving((prev) => {
      const s = new Set(prev)
      s.delete(modelId)
      return s
    })
  }

  const toggle = (m: CatalogModel) => void setEnabled(m.id, !enabledIds.has(m.id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar modelo (ex.: claude, gpt, gemini, qwen)"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span className="text-muted-foreground whitespace-nowrap text-xs">
          <span className="brand-text font-medium">{enabledIds.size}</span> ativos
        </span>
        <Button variant="ghost" size="icon-sm" onClick={load} aria-label="Recarregar modelos" disabled={loading}>
          <RotateCw className={cn('size-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Filtros por tipo. */}
      {availableTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="Todos" active={type === null} onClick={() => setType(null)} />
          {availableTypes.map((t) => (
            <FilterChip key={t.key} label={t.label} active={type === t.key} onClick={() => setType(t.key)} />
          ))}
        </div>
      )}

      {/* Chips dos selecionados. */}
      {enabledModels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {enabledModels.map((m) => (
            <span
              key={m.id}
              className="bg-muted/40 inline-flex items-center gap-1 rounded-md border py-0.5 pr-1 pl-1.5 text-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- logo estático em /public; sem otimização do next/image */}
              <img
                src={providerLogo(authorSlug(m.id))}
                onError={onLogoError}
                alt=""
                className={cn('size-3.5 shrink-0 object-contain', isMonochromeLogo(authorSlug(m.id)) && 'dark:invert')}
                draggable={false}
              />
              <span className="max-w-[160px] truncate">{stripAuthorFromName(m.name)}</span>
              <button
                onClick={() => void setEnabled(m.id, false)}
                aria-label={`Remover ${stripAuthorFromName(m.name)}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-destructive border-destructive/30 bg-destructive/10 rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" /> Carregando modelos…
        </div>
      ) : catalog.length === 0 && error ? (
        <div className="flex flex-col items-start gap-2 py-6">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RotateCw className="size-3.5" /> Tentar de novo
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-10 text-sm">Nenhum modelo encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const on = enabledIds.has(m.id)
            const caps = modelCapabilities(m)
            return (
              <div
                key={m.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-2.5 transition-colors',
                  on
                    ? 'border-[var(--brand-2)]/70 bg-[var(--brand-2)]/[0.06]'
                    : 'border-border bg-card',
                )}
              >
                <div className="bg-background mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático em /public; sem otimização do next/image */}
                  <img
                    src={providerLogo(authorSlug(m.id))}
                    onError={onLogoError}
                    alt=""
                    loading="lazy"
                    className={cn('size-5 object-contain', isMonochromeLogo(authorSlug(m.id)) && 'dark:invert')}
                    draggable={false}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium leading-tight">
                        {stripAuthorFromName(m.name)}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px]">
                        {authorSlug(m.id)}
                        {m.paramSize ? ` · ${m.paramSize}` : ''} · {formatContext(m.contextLength)} ctx
                      </span>
                    </div>
                    <Switch
                      checked={on}
                      disabled={saving.has(m.id)}
                      onCheckedChange={() => toggle(m)}
                      aria-label={`Ativar ${stripAuthorFromName(m.name)}`}
                      className="mt-0.5 shrink-0 data-checked:border-[var(--brand-2)] data-checked:bg-[var(--brand-2)]"
                    />
                  </div>
                  {caps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {caps.map((c) => (
                        <span
                          key={c}
                          className="bg-muted text-muted-foreground rounded px-1.5 py-px text-[10px] font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
