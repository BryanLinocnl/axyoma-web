'use client'

import { useState } from 'react'
import { Globe, Key, Eye, EyeOff, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { postSecret } from './post-secret'
import type { InternetConfig } from './types'

// Porte do desktop IntegrationsSection — "Integrações (internet)"
// (Aplication/.../config/ConfigArea.tsx). web_search (toggle, incluída no app),
// Unsplash (Access Key opcional), Vercel (token de deploy), web_fetch (sem chave).
// O toggle web_search é NÃO-secreto (persiste na nuvem); as chaves são segredos
// (Vault): vercel/token e vercel/unsplash_access_key.

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Key className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pr-8 pl-8 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  )
}

export function InternetSection({
  config,
  onChange,
  token,
}: {
  config: InternetConfig
  onChange: (next: InternetConfig) => void
  token: string
}): React.JSX.Element {
  const [unsplash, setUnsplash] = useState('')
  const [vercel, setVercel] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null)

  // Toggle da busca web persiste na nuvem na hora (não depende do botão Salvar).
  const toggleWebSearch = (v: boolean): void => {
    onChange({ webSearchEnabled: v })
  }

  async function save(): Promise<void> {
    setSaving(true)
    setStatus(null)
    let ok = true
    let msg = ''
    const u = unsplash.trim()
    const t = vercel.trim()
    if (u) {
      const r = await postSecret({ token, provider: 'vercel', field: 'unsplash_access_key', value: u })
      if (!r.ok) {
        ok = false
        msg = r.message ?? 'Falha ao salvar a Access Key do Unsplash.'
      }
    }
    if (ok && t) {
      const r = await postSecret({ token, provider: 'vercel', field: 'token', value: t })
      if (!r.ok) {
        ok = false
        msg = r.message ?? 'Falha ao salvar o token da Vercel.'
      }
    }
    setSaving(false)
    if (ok) {
      setUnsplash('')
      setVercel('')
      setStatus({ kind: 'ok', msg: u || t ? 'Chaves cifradas e guardadas.' : 'Nada para salvar.' })
    } else {
      setStatus({ kind: 'error', msg })
    }
  }

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <Globe className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">Integrações (internet)</h2>
      </div>
      <p className="text-muted-foreground mb-4 max-w-md text-xs">
        Ferramentas de internet do agente. As chaves são cifradas no Vault; nunca enviadas ao modelo.
      </p>
      <div>
        <div className="flex flex-col gap-3">
          {/* Busca web */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Busca web <span className="text-muted-foreground font-mono text-xs">(web_search)</span>
              </span>
              <span className="text-muted-foreground text-[11px]">Incluída no app — não precisa de chave.</span>
            </div>
            <Switch checked={config.webSearchEnabled} onCheckedChange={toggleWebSearch} />
          </div>
          {/* Unsplash */}
          <div className="flex flex-col gap-1.5 rounded-lg border p-3">
            <label className="text-sm font-medium">
              Unsplash <span className="text-muted-foreground font-mono text-xs">(search_images)</span>
            </label>
            <div className="max-w-md">
              <SecretInput value={unsplash} onChange={setUnsplash} placeholder="Access Key (opcional)" />
            </div>
            <p className="text-muted-foreground text-[11px]">
              Opcional: a busca web já retorna imagens. Use só se quiser fotos curadas do Unsplash.
            </p>
          </div>
          {/* Vercel — habilita as tools de deploy (vercel_deploy/link/env) */}
          <div className="flex flex-col gap-1.5 rounded-lg border p-3">
            <label className="text-sm font-medium">
              Vercel <span className="text-muted-foreground font-mono text-xs">(vercel_deploy)</span>
            </label>
            <div className="max-w-md">
              <SecretInput value={vercel} onChange={setVercel} placeholder="Token da conta Vercel" />
            </div>
            <p className="text-muted-foreground text-[11px]">
              Gere em vercel.com/account/tokens. Habilita o agente a fazer deploy via CLI (vercel_deploy,
              vercel_link, vercel_env_pull). Sem token, essas tools ficam ocultas.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-[11px]">
            <span className="font-mono">web_fetch</span> (ler página por URL) não precisa de chave.
          </p>
          <Button size="sm" className="gap-2" disabled={saving} onClick={save}>
            <Save className="size-3.5" />
            {saving ? 'Salvando…' : 'Salvar chaves'}
          </Button>
        </div>
        {status && (
          <p className={status.kind === 'ok' ? 'mt-2 text-xs text-emerald-600 dark:text-emerald-400' : 'text-destructive mt-2 text-xs'}>
            {status.msg}
          </p>
        )}
      </div>
    </section>
  )
}
