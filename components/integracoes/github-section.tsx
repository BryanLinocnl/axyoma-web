'use client'

import { useState } from 'react'
import { Github } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { postSecret } from './post-secret'
import type { GithubConfig } from './types'

// Porte do desktop GitHubSection (Aplication/.../config/ConfigArea.tsx), recorte
// "Conectar com token". No web não há device-flow nem clone local (isso é do
// desktop); guardamos o PAT cifrado no Vault e marcamos "conectado" na nuvem —
// o desktop usa o token para acessar repos privados/issues/PRs.
export function GithubSection({
  config,
  onChange,
  token,
}: {
  config: GithubConfig
  onChange: (next: GithubConfig) => void
  token: string
}): React.JSX.Element {
  const [pat, setPat] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  async function connect(): Promise<void> {
    const value = pat.trim()
    if (!value) return
    setConnecting(true)
    setError('')
    const r = await postSecret({ token, provider: 'github', field: 'pat', value })
    setConnecting(false)
    if (r.ok) {
      setPat('')
      onChange({ connected: true })
    } else {
      setError(r.message ?? 'Não foi possível conectar.')
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">GitHub</h2>
      <p className="text-muted-foreground mb-4 text-xs">
        Conecte sua conta para clonar repositórios (públicos e privados) e dar ao agente acesso nativo a issues e
        pull requests.
      </p>

      {config.connected ? (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
              <Github className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Conectado</p>
              <p className="text-muted-foreground text-xs">Token cifrado no Vault — usado pelo app desktop.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onChange({ connected: false })}>
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Conectar com token</p>
          <p className="text-muted-foreground mb-2 text-xs">
            Personal Access Token com escopo <code>repo</code>.{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=AXYOMA%20AI"
              target="_blank"
              rel="noreferrer"
              className="underline hover:opacity-80"
            >
              Gerar token
            </a>
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_…"
              className="h-9 max-w-[320px] font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void connect()
              }}
            />
            <Button variant="outline" size="sm" onClick={connect} disabled={connecting || !pat.trim()}>
              {connecting ? 'Conectando…' : 'Conectar'}
            </Button>
          </div>
          {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
          <p className="text-muted-foreground mt-2 text-[11px]">
            O token é cifrado no Supabase Vault e nunca gravado em claro nem devolvido ao navegador.
          </p>
        </div>
      )}
    </section>
  )
}
