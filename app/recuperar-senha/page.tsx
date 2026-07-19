'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { supabase } from '@/lib/supabase-browser'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Página de recuperação de senha: o usuário informa o e-mail e recebe um link de
// redefinição. Rota pública (acessível deslogado também). O link do e-mail leva
// para /redefinir-senha, onde a nova senha é definida.
export default function RecuperarSenhaPage(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) return
    setSending(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setSending(false)
    if (err) {
      setError(err.message)
      return
    }
    setSent(true)
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <AxiomaLogo id="recover" className="mb-4 size-10" />
          <h1 className="text-xl font-semibold">Recuperar senha</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-sm">
              Se existir uma conta com <span className="font-medium">{email.trim()}</span>, o link de redefinição foi
              enviado. Verifique sua caixa de entrada.
            </p>
            <Link href="/conta/sua-conta/sua-conta" className="text-muted-foreground mt-4 inline-block text-xs underline underline-offset-2">
              Voltar
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="rec-email" className="mb-2">
                E-mail
              </Label>
              <Input
                id="rec-email"
                type="email"
                required
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? 'Enviando…' : 'Enviar link de redefinição'}
            </Button>
            <Link href="/conta/sua-conta/sua-conta" className="text-muted-foreground text-center text-xs underline underline-offset-2">
              Cancelar
            </Link>
          </form>
        )}
      </Card>
    </main>
  )
}
