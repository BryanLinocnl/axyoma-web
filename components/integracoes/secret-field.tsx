'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LockIcon, ShieldIcon } from 'lucide-react'
import type { Provider } from './types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// Campo de credencial (segredo) de uma integração.
//
// SEGURANÇA — leia antes de mexer: o valor digitado vive APENAS no estado local
// do componente (some ao desmontar) e é enviado SOMENTE ao nosso endpoint HTTPS
// `/api/integrations/secret` (com o bearer do usuário), que o cifra no Supabase
// Vault e mapeia (provider/field)→secret id. O valor NUNCA é gravado em
// `integrations_config` (que é claro) e NUNCA é lido de volta pro browser — o
// desktop o recupera via edge function autenticada. Após salvar, limpamos o
// campo (não mantemos o segredo em memória à toa).
export function SecretField({
  provider,
  field,
  label,
  placeholder,
  help,
  token,
}: {
  provider: Provider
  field: string
  label: string
  placeholder?: string
  help?: string
  token: string
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [state, setState] = useState<SaveState>('idle')
  const [msg, setMsg] = useState('')

  async function attemptSave(): Promise<void> {
    setState('saving')
    setMsg('')
    try {
      // Enviamos o valor SOMENTE para o nosso endpoint HTTPS, que o cifra no
      // Supabase Vault. O valor não é gravado em claro nem lido de volta.
      const res = await fetch('/api/integrations/secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, field, value }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } }
      if (res.ok && body?.ok) {
        setState('saved')
        setMsg('Credencial cifrada e guardada com segurança.')
        setValue('') // não mantém o segredo no estado após salvar
      } else {
        setState('error')
        setMsg(body?.error?.message ?? 'Não foi possível salvar a credencial.')
      }
    } catch {
      setState('error')
      setMsg('Falha de rede ao contatar o serviço de credenciais.')
    }
  }

  return (
    <div className="border-border bg-muted/30 space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="gap-1.5">
          <LockIcon className="size-3.5" />
          {label}
        </Label>
        <Badge variant="outline" className="gap-1">
          <ShieldIcon className="size-3" />
          Cifrado no Supabase Vault
        </Badge>
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={state === 'saving' || value.trim().length === 0}
          onClick={attemptSave}
        >
          {state === 'saving' ? 'Enviando…' : 'Salvar credencial'}
        </Button>
      </div>
      {help && <p className="text-muted-foreground text-xs">{help}</p>}
      {state === 'saved' && <p className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>}
      {state === 'error' && <p className="text-destructive text-xs">{msg}</p>}
      <p className="text-muted-foreground text-xs">
        O valor é enviado apenas ao nosso servidor por HTTPS, cifrado no Supabase Vault e nunca gravado em
        texto claro nem lido de volta pro navegador — só o desktop autenticado o recupera.
      </p>
    </div>
  )
}
