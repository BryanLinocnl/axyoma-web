'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import { Card, CardContent } from '@/components/ui/card'
import { GithubSection } from './github-section'
import { InternetSection } from './internet-section'
import { McpSection } from './mcp-section'
import {
  DEFAULT_GITHUB,
  DEFAULT_INTERNET,
  DEFAULT_MCP,
  mergeGithub,
  mergeInternet,
  mergeMcp,
  type Configs,
  type GithubConfig,
  type InternetConfig,
  type McpConfig,
  type Provider,
} from './types'

// Página P4 — Integrações (client). REESCRITA para ser cópia fiel do desktop
// (Configurações → GitHub / Integrações internet / MCP).
//
// Persistência (mesma plumbing já construída):
//  • config NÃO-sensível → `integrations_config` (uma linha por provider, PK
//    (user_id, provider), RLS `auth.uid() = user_id`). Provider→área:
//    github={connected} · vercel={webSearchEnabled} · mcp={enabled, servers[]}.
//  • segredos (PAT/token/access key/tokens MCP) → Supabase Vault via
//    `/api/integrations/secret` — nunca em `integrations_config` nem no bundle.
//
// SINCRONIZAÇÃO BIDIRECIONAL (web ↔ desktop), como em model_selection:
//  • carga inicial: lê `integrations_config` no mount (RLS).
//  • nuvem → web ao vivo: assina Realtime `postgres_changes` filtrado ao usuário;
//    quando o DESKTOP (ou outra aba) muda a config (ex.: servidores MCP),
//    refletimos aqui sem reload.
//  • web → nuvem: cada mutação persiste na hora (upsert), como no desktop.
// Guard: enquanto um save de um provider está em voo, ignoramos o eco Realtime
// desse provider para não pisar no estado otimista.
export function IntegracoesClient(): React.JSX.Element {
  const { userId, token } = useConta()
  const [configs, setConfigs] = useState<Configs>({
    github: DEFAULT_GITHUB,
    internet: DEFAULT_INTERNET,
    mcp: DEFAULT_MCP,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Providers com save em voo — Realtime não sobrescreve estes até confirmar.
  const inFlightRef = useRef<Set<Provider>>(new Set())

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase
      .from('integrations_config')
      .select('provider, config')
      .eq('user_id', userId)
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          setError('Não foi possível carregar suas integrações.')
          setLoading(false)
          return
        }
        const next: Configs = { github: DEFAULT_GITHUB, internet: DEFAULT_INTERNET, mcp: DEFAULT_MCP }
        for (const row of (data ?? []) as { provider: Provider; config: unknown }[]) {
          if (row.provider === 'github') next.github = mergeGithub(row.config)
          else if (row.provider === 'vercel') next.internet = mergeInternet(row.config)
          else if (row.provider === 'mcp') next.mcp = mergeMcp(row.config)
        }
        setConfigs(next)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // nuvem → web ao vivo. Canal criado de forma SÍNCRONA (o cleanup captura a
  // referência e a remove) — evita "cannot add postgres_changes callbacks after
  // subscribe()". O JWT já está no socket do Realtime, então a RLS vale.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`integrations-config-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'integrations_config', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as {
            provider?: Provider
            config?: unknown
          }
          const provider = row?.provider
          if (provider !== 'github' && provider !== 'vercel' && provider !== 'mcp') return
          if (inFlightRef.current.has(provider)) return

          setConfigs((prev) => {
            if (payload.eventType === 'DELETE') {
              if (provider === 'github') return { ...prev, github: DEFAULT_GITHUB }
              if (provider === 'vercel') return { ...prev, internet: DEFAULT_INTERNET }
              return { ...prev, mcp: DEFAULT_MCP }
            }
            if (provider === 'github') return { ...prev, github: mergeGithub(row.config) }
            if (provider === 'vercel') return { ...prev, internet: mergeInternet(row.config) }
            return { ...prev, mcp: mergeMcp(row.config) }
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  // Upsert imediato de um provider (web → nuvem), com guarda anti-eco.
  const persist = useCallback(
    async (provider: Provider, config: object): Promise<void> => {
      inFlightRef.current.add(provider)
      setError('')
      const { error: saveError } = await supabase.from('integrations_config').upsert(
        { user_id: userId, provider, config, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,provider' },
      )
      inFlightRef.current.delete(provider)
      if (saveError) setError('Não foi possível salvar. Tente novamente.')
    },
    [userId],
  )

  const setGithub = (next: GithubConfig): void => {
    setConfigs((c) => ({ ...c, github: next }))
    void persist('github', next)
  }
  const setInternet = (next: InternetConfig): void => {
    setConfigs((c) => ({ ...c, internet: next }))
    void persist('vercel', next)
  }
  const setMcp = (next: McpConfig): void => {
    setConfigs((c) => ({ ...c, mcp: next }))
    void persist('mcp', next)
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando integrações…</p>
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Integrações</h1>
        <p className="text-muted-foreground text-sm">
          GitHub, ferramentas de internet e servidores MCP do agente — os mesmos do app desktop. As chaves ficam
          cifradas no Vault; a configuração sincroniza na nuvem e ao vivo com o desktop.
        </p>
      </div>

      {error && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}

      <Card>
        <CardContent>
          <GithubSection config={configs.github} onChange={setGithub} token={token} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <InternetSection config={configs.internet} onChange={setInternet} token={token} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <McpSection config={configs.mcp} onChange={setMcp} token={token} />
        </CardContent>
      </Card>
    </div>
  )
}
