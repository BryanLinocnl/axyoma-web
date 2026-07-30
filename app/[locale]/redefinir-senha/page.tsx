'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { supabase } from '@/lib/supabase-browser'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Ver o comentário em SiteNav.tsx: href cru derruba o visitante para o pt-BR.
import { Link } from '@/i18n/navigation'

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
// As regras de senha são as MESMAS do cadastro e vivem no namespace `auth`
// (chaves `ruleLen`, `ruleLower`…). Duplicar o texto aqui seria a forma mais
// fácil de as duas telas divergirem na próxima revisão de copy.
const RULES = ['len', 'lower', 'upper', 'digit', 'special'] as const

export default function RedefinirSenhaPage(): React.JSX.Element {
  const t = useTranslations('reset')
  const tAuth = useTranslations('auth')
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
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </div>

        {!ready ? (
          <p className="text-muted-foreground text-center text-sm">{t('loading')}</p>
        ) : done ? (
          <p className="text-center text-sm text-green-500">{t('done')}</p>
        ) : !hasSession ? (
          <p className="text-muted-foreground text-center text-sm">
            {t.rich('invalid', {
              link: (chunks) => (
                <Link href="/recuperar-senha" className="underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="np" className="mb-2">
                {t('newPassword')}
              </Label>
              <Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <ul className="-mt-1 flex flex-col gap-1">
              {RULES.map((k) => (
                <li key={k} className={`flex items-center gap-2 text-xs ${c[k] ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {c[k] ? <Check className="size-3.5" /> : <X className="size-3.5" />}{' '}
                  {tAuth(`rule${k[0].toUpperCase()}${k.slice(1)}`)}
                </li>
              ))}
            </ul>
            <div>
              <Label htmlFor="cp" className="mb-2">
                {t('confirm')}
              </Label>
              <Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {confirm && confirm !== pw && <p className="text-destructive mt-1 text-xs">{t('mismatch')}</p>}
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button type="submit" disabled={!valid || saving} className="w-full">
              {saving ? t('saving') : t('submit')}
            </Button>
          </form>
        )}
      </Card>
    </main>
  )
}
