'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConta } from '@/lib/conta-context'
import { supabase } from '@/lib/supabase-browser'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchCatalog, stripAuthorFromName, type CatalogModel } from '@/lib/openrouter-catalog'
import type { ModelOption } from './types'

// Fallback mínimo só se o catálogo não carregar de jeito nenhum.
const FALLBACK: ModelOption[] = [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' }]

// Seletor de modelo do chat. Os modelos disponíveis são EXATAMENTE os que o
// usuário ativou em Modelos (`model_selection`, enabled=true) — os nomes vêm do
// catálogo público (mesma fonte da página Modelos). Atualiza ao vivo via Realtime
// quando a seleção muda (no web ou no desktop).
export function ModelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const { userId } = useConta()
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set())

  // Catálogo público (não depende de login).
  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Seleção do usuário (enabled=true), via sessão/RLS.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('model_selection')
        .select('model_id, enabled')
        .eq('user_id', userId)
      if (cancelled) return
      const set = new Set<string>()
      for (const row of (data as { model_id: string; enabled: boolean }[] | null) ?? []) {
        if (row.enabled) set.add(row.model_id)
      }
      setEnabledIds(set)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // Atualiza ao vivo quando a seleção muda (web ou desktop) — mesmo canal-pattern
  // da página Modelos (síncrono, cleanup remove).
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`model-selection-chat-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'model_selection', filter: `user_id=eq.${userId}` },
        (payload) => {
          setEnabledIds((prev) => {
            const next = new Set(prev)
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { model_id?: string }
              if (old.model_id) next.delete(old.model_id)
            } else {
              const row = payload.new as { model_id: string; enabled: boolean }
              if (row.enabled) next.add(row.model_id)
              else next.delete(row.model_id)
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

  // Modelos disponíveis = os ativados pelo usuário (nomes do catálogo). Se ainda
  // não ativou nenhum, oferece os primeiros do catálogo por relevância.
  const models = useMemo<ModelOption[]>(() => {
    const byId = new Map(catalog.map((m) => [m.id, m]))
    if (enabledIds.size > 0) {
      const list: ModelOption[] = []
      for (const id of enabledIds) {
        const m = byId.get(id)
        list.push({ id, name: m ? stripAuthorFromName(m.name) : id })
      }
      return list.sort((a, b) => a.name.localeCompare(b.name))
    }
    if (catalog.length > 0) {
      return catalog.slice(0, 8).map((m) => ({ id: m.id, name: stripAuthorFromName(m.name) }))
    }
    return FALLBACK
  }, [catalog, enabledIds])

  // Garante que o valor atual exista na lista; senão adota o primeiro.
  useEffect(() => {
    if (models.length && !models.some((m) => m.id === value)) {
      onChange(models[0].id)
    }
  }, [models, value, onChange])

  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger
        size="sm"
        aria-label="Selecionar modelo"
        className="text-muted-foreground hover:text-foreground max-w-[220px] gap-1 border-0 bg-transparent px-2 shadow-none outline-none focus:outline-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-muted/50"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-xl">
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id} className="rounded-lg">
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
