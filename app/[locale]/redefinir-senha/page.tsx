'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { supabase } from '@/lib/supabase-browser'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Alvo do link de redefinição enviado por e-mail. O supabase-js detecta o token
// de recovery na URL e abre uma sessão de recuperação; aqui o usuário define a
// nova senha (updateUser). Sem sessão de recovery, orienta a pedir novo link.
function checks(pw: string) {
  return {
    len: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  }
}
const LABELS: Record<keyof ReturnType<typeof checks>, string> = {
  len: 'Mínimo de 8 caracteres',
  lower: 'Uma letra minúscula',
  upper: 'Uma letra maiúscula',
  digit: 'Um número',
  special: 'Um caractere especial',
}

export default function RedefinirSenhaPage(): React.JSX.Element {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // O link de recovery abre a sessão automaticamente (detectSessionInUrl).
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setHasSession(Boolean(data.session))
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const c = checks(pw)
  const valid = Object.values(c).every(Boolean) && pw === confirm

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setDone(true)
    setTimeout(() => router.replace('/conta/sua-conta/sua-conta'), 1500)
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <AxiomaLogo id="reset" className="mb-4 size-10" />
          <h1 className="text-xl font-semibold">Definir nova senha</h1>
        </div>

        {!ready ? (
          <p className="text-muted-foreground text-center text-sm">Carregando…</p>
        ) : done ? (
          <p className="text-center text-sm text-green-500">Senha redefinida! Redirecionando…</p>
        ) : !hasSession ? (
          <p className="text-muted-foreground text-center text-sm">
            Link inválido ou expirado. Peça um novo em{' '}
            <a href="/recuperar-senha" className="underline underline-offset-2">
              recuperar senha
            </a>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="np" className="mb-2">
                Nova senha
              </Label>
              <Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <ul className="-mt-1 flex flex-col gap-1">
              {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((k) => (
                <li key={k} className={`flex items-center gap-2 text-xs ${c[k] ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {c[k] ? <Check className="size-3.5" /> : <X className="size-3.5" />} {LABELS[k]}
                </li>
              ))}
            </ul>
            <div>
              <Label htmlFor="cp" className="mb-2">
                Repetir nova senha
              </Label>
              <Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {confirm && confirm !== pw && <p className="text-destructive mt-1 text-xs">As senhas não coincidem.</p>}
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button type="submit" disabled={!valid || saving} className="w-full">
              {saving ? 'Salvando…' : 'Redefinir senha'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  )
}
