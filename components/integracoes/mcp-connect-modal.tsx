'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { sanitizeServerForCloud, type McpServer } from './types'
import { postSecret } from './post-secret'
import type { McpPreset } from './mcp-presets'

// Porte do desktop McpConnectModal (Aplication/.../config/McpConnectModal.tsx).
// null preset = "Personalizado" (comando/args/env crus). Ao salvar, o segredo dos
// campos `secret` vai pro Vault (provider='mcp', field=`<serverId>.<campo>`) e a
// estrutura REDIGIDA (sanitizeServerForCloud) volta pro chamador gravar na nuvem.

function SecretField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pr-16 font-mono"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 text-xs"
      >
        {visible ? 'ocultar' : 'mostrar'}
      </button>
    </div>
  )
}

function parseCustomArgs(raw: string): string[] {
  return raw.trim() ? raw.trim().split(/\s+/) : []
}

function parseCustomEnv(raw: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    const i = t.indexOf('=')
    if (i <= 0) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

export function McpConnectModal({
  preset,
  open,
  onOpenChange,
  onAdd,
  token,
}: {
  preset: McpPreset | null
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Recebe o servidor JÁ redigido (sem segredos) para gravar na nuvem. */
  onAdd: (server: McpServer) => void
  token: string
}): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})
  const [customName, setCustomName] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [customArgs, setCustomArgs] = useState('')
  const [customEnv, setCustomEnv] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    // Reset intencional dos campos ao (re)abrir o modal para um preset.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset-on-open
    setValues({})
    setCustomName('')
    setCustomCommand('')
    setCustomArgs('')
    setCustomEnv('')
    setError('')
  }, [open, preset])

  const isCustom = !preset
  const canSave = isCustom
    ? !!(customName.trim() && customCommand.trim())
    : preset!.fields.every((f) => values[f.key]?.trim())

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    const id = crypto.randomUUID()

    const built = isCustom
      ? {
          name: customName.trim(),
          command: customCommand.trim(),
          args: parseCustomArgs(customArgs),
          env: parseCustomEnv(customEnv),
        }
      : { name: preset!.name, ...preset!.build(values) }

    const server: McpServer = { id, enabled: true, ...built }

    // Segredos dos presets → Vault (provider='mcp', field=`<serverId>.<campo>`).
    // Falha aqui não impede salvar a estrutura (redigida) — só avisamos.
    if (!isCustom) {
      for (const f of preset!.fields) {
        if (!f.secret) continue
        const v = values[f.key]?.trim()
        if (!v) continue
        const r = await postSecret({ token, provider: 'mcp', field: `${id}.${f.key}`, value: v })
        if (!r.ok) setError(r.message ?? 'Não foi possível cifrar a credencial.')
      }
    }

    // Grava na nuvem a versão REDIGIDA (sem segredos, igual ao desktop).
    onAdd(sanitizeServerForCloud(server))
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isCustom ? 'Server MCP personalizado' : preset!.name}</DialogTitle>
          <DialogDescription>
            {isCustom
              ? 'Pra servers MCP fora do catálogo — comando, argumentos e variáveis de ambiente crus.'
              : preset!.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isCustom ? (
            <>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs">Nome</label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="ex.: meu-server" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs">Comando</label>
                <Input value={customCommand} onChange={(e) => setCustomCommand(e.target.value)} placeholder="ex.: npx" className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs">Argumentos</label>
                <Input value={customArgs} onChange={(e) => setCustomArgs(e.target.value)} placeholder="-y pacote --flag=valor" className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs">Variáveis de ambiente (uma por linha)</label>
                <textarea
                  value={customEnv}
                  onChange={(e) => setCustomEnv(e.target.value)}
                  placeholder={'CHAVE=valor'}
                  rows={2}
                  className="focus-visible:ring-ring w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-1"
                />
              </div>
            </>
          ) : preset!.fields.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2.5 text-xs">
              Este server não precisa de configuração — é só conectar.
            </p>
          ) : (
            preset!.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground text-xs">{f.label}</label>
                  {f.helpUrl && (
                    <a href={f.helpUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-xs underline">
                      {f.helpLabel ?? 'Saiba mais'}
                    </a>
                  )}
                </div>
                {f.secret ? (
                  <SecretField value={values[f.key] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} placeholder={f.placeholder} />
                ) : (
                  <Input
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="h-9 font-mono"
                  />
                )}
              </div>
            ))
          )}
        </div>

        {error && <p className="text-destructive text-xs">{error}</p>}
        {!isCustom && preset!.fields.some((f) => f.secret) && (
          <p className="text-muted-foreground text-[11px]">
            A credencial é cifrada no Supabase Vault; a nuvem guarda só a estrutura (sem o segredo).
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={!canSave || saving}>
            {saving ? 'Conectando…' : 'Conectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
