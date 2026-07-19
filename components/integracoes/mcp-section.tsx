'use client'

import { useState } from 'react'
import { Plug, Trash2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { MCP_PRESETS, type McpPreset } from './mcp-presets'
import { MCP_PRESET_LOGOS, MCP_FALLBACK_ICON } from './mcp-brand-icons'
import { McpConnectModal } from './mcp-connect-modal'
import type { McpConfig, McpServer } from './types'

// Porte do desktop MCPSection (Aplication/.../config/ConfigArea.tsx). Grid de
// presets (12) + "Personalizado", e lista de servidores configurados. As
// mutações persistem NA NUVEM na hora (via onChange) — o desktop reflete ao vivo.
export function McpSection({
  config,
  onChange,
  token,
}: {
  config: McpConfig
  onChange: (next: McpConfig) => void
  token: string
}): React.JSX.Element {
  // undefined = modal fechado · null = "Personalizado" · McpPreset = preset escolhido
  const [modalTarget, setModalTarget] = useState<McpPreset | null | undefined>(undefined)

  const addServer = (server: McpServer): void => {
    onChange({ ...config, servers: [...config.servers, server] })
  }
  const removeServer = (id: string): void => {
    onChange({ ...config, servers: config.servers.filter((s) => s.id !== id) })
  }
  const toggleServer = (id: string, enabled: boolean): void => {
    onChange({ ...config, servers: config.servers.map((s) => (s.id === id ? { ...s, enabled } : s)) })
  }

  // Preset e server são ligados pelo nome (o modal salva server.name = preset.name).
  const configuredByName = new Set(config.servers.map((s) => s.name))

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">MCP</h2>
      <p className="text-muted-foreground mb-4 text-xs">
        Conecte servers MCP pra dar ao agente acesso às tools deles, lado a lado com as nativas. Escolha um dos
        mais usados ou configure um personalizado.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MCP_PRESETS.map((preset) => {
          const Icon = MCP_PRESET_LOGOS[preset.id] ?? MCP_FALLBACK_ICON
          const configured = configuredByName.has(preset.name)
          return (
            <button
              key={preset.id}
              onClick={() => setModalTarget(preset)}
              title={configured ? 'Configurado' : undefined}
              className={cn(
                'hover:bg-muted relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
                configured && 'border-primary/30 bg-primary/5',
              )}
            >
              {configured && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-green-500" />}
              <Icon className="text-foreground/80 size-4" />
              <span className="text-sm font-medium">{preset.name}</span>
              <span className="text-muted-foreground line-clamp-2 text-xs">{preset.description}</span>
            </button>
          )
        })}
        <button
          onClick={() => setModalTarget(null)}
          className="hover:bg-muted flex flex-col items-start gap-1.5 rounded-lg border border-dashed p-3 text-left transition-colors"
        >
          <Plug className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Personalizado</span>
          <span className="text-muted-foreground line-clamp-2 text-xs">Comando, argumentos e variáveis próprias.</span>
        </button>
      </div>

      {config.servers.length > 0 && (
        <div className="space-y-1">
          {config.servers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    s.enabled ? 'bg-green-500' : 'bg-muted-foreground/40',
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {[s.command, ...s.args].join(' ') || (s.enabled ? 'habilitado' : 'desabilitado')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch checked={s.enabled} onCheckedChange={(v) => toggleServer(s.id, v)} />
                <button
                  onClick={() => removeServer(s.id)}
                  className="text-muted-foreground hover:text-red-500 rounded p-1 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <McpConnectModal
        preset={modalTarget ?? null}
        open={modalTarget !== undefined}
        onOpenChange={(v) => {
          if (!v) setModalTarget(undefined)
        }}
        onAdd={addServer}
        token={token}
      />
    </section>
  )
}
