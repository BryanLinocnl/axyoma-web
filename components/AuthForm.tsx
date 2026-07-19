'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { AxiomaLogo } from './AxiomaLogo'

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

function AppleIcon(): React.JSX.Element {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}
function GoogleIcon(): React.JSX.Element {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

export function AuthForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }): React.JSX.Element {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSignup = mode === 'signup'
  const c = checks(password)
  const strong = Object.values(c).every(Boolean)
  const match = password === confirm
  const canSubmit = isSignup
    ? Boolean(name.trim() && email.trim()) && strong && match
    : Boolean(email.trim() && password)

  async function oauth(provider: 'google' | 'apple'): Promise<void> {
    setErr(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/conta` },
    })
    if (error) setErr(error.message)
  }

  async function reset(): Promise<void> {
    if (!email.trim()) { setMsg('Digite seu e-mail acima primeiro.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setErr(error ? error.message : null)
    if (!error) setMsg('Enviamos um link de redefinição para o seu e-mail.')
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setErr(null); setMsg(null); setSubmitting(true)
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (error) throw error
        const { data } = await supabase.auth.getSession()
        if (data.session) router.push('/conta/visao-geral/visao-geral')
        else setMsg('Conta criada! Confirme o e-mail que enviamos para entrar.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        router.push('/conta/visao-geral/visao-geral')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao autenticar.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-500'

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="mb-1 flex items-center justify-center gap-2.5">
        <AxiomaLogo id="auth" className="h-8 w-8" />
        <span className="font-brand text-xl italic text-neutral-100">Axyoma</span>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-5 text-center">
          <h1 className="text-xl font-semibold text-neutral-50">
            {isSignup ? 'Criar conta' : 'Bem-vindo de volta'}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {isSignup ? 'Preencha os dados para criar sua conta' : 'Entre com sua conta Apple ou Google'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {!isSignup && (
            <>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => oauth('apple')} className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-800">
                  <AppleIcon /> Entrar com Apple
                </button>
                <button type="button" onClick={() => oauth('google')} className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-800">
                  <GoogleIcon /> Entrar com Google
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="h-px flex-1 bg-neutral-800" /> Ou continue com <span className="h-px flex-1 bg-neutral-800" />
              </div>
            </>
          )}

          {isSignup && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-neutral-300">Nome</label>
              <input className={inputCls} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-neutral-300">E-mail</label>
            <input type="email" className={inputCls} placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center">
              <label className="text-sm text-neutral-300">Senha</label>
              {!isSignup && (
                <button type="button" onClick={reset} className="ml-auto text-sm text-neutral-400 underline-offset-4 hover:underline">
                  Esqueceu a senha?
                </button>
              )}
            </div>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className={`${inputCls} pr-9`} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {isSignup && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-neutral-300">Repetir senha</label>
                <input type={showPw ? 'text' : 'password'} className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                {confirm.length > 0 && !match && <p className="text-xs text-red-400">As senhas não coincidem.</p>}
              </div>
              <ul className="flex flex-col gap-1">
                {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((k) => (
                  <li key={k} className={`flex items-center gap-2 text-xs ${c[k] ? 'text-green-500' : 'text-neutral-500'}`}>
                    {c[k] ? <Check className="size-3.5" /> : <X className="size-3.5" />} {LABELS[k]}
                  </li>
                ))}
              </ul>
            </>
          )}

          {err && <p className="text-xs text-red-400">{err}</p>}
          {msg && <p className="text-xs text-green-500">{msg}</p>}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="brand-gradient rounded-lg py-2.5 text-sm font-semibold text-black transition-transform enabled:hover:scale-[1.01] disabled:opacity-50"
          >
            {submitting ? (isSignup ? 'Criando...' : 'Entrando...') : isSignup ? 'Criar conta' : 'Entrar'}
          </button>

          <p className="text-center text-sm text-neutral-400">
            {isSignup ? 'Já tem conta? ' : 'Não tem conta? '}
            <button type="button" className="text-neutral-100 underline underline-offset-4" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setErr(null); setMsg(null) }}>
              {isSignup ? 'Entrar' : 'Cadastre-se'}
            </button>
          </p>
        </form>
      </div>

      <p className="px-6 text-center text-xs text-neutral-500">
        Ao continuar, você concorda com nossos <a href="/docs" className="underline">Termos de Serviço</a> e <a href="/docs" className="underline">Política de Privacidade</a>.
      </p>
    </div>
  )
}
