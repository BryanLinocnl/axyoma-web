'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
// Ver o comentário em SiteNav.tsx: href cru derruba o visitante para o pt-BR.
import { Link } from '@/i18n/navigation'
import { Check, X, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { AxiomaMark } from './AxiomaMark'
import { Turnstile, isCaptchaEnabled } from './Turnstile'

/**
 * Login do site — PORTE do login do app desktop
 * (Aplication/src/renderer/src/components/{LoginPage,login-form}.tsx).
 *
 * A ordem, os rótulos e a hierarquia são os mesmos de lá, de propósito: quem
 * entra pelo site e depois instala o app tem que reconhecer a mesma tela. O
 * que muda é só o material — aqui os tokens do mundo Glass Bench (DESIGN.md)
 * no lugar dos do shadcn do app.
 *
 * Toda a lógica (Supabase, Turnstile, reset de senha, checklist de força) é a
 * que já existia; esta revisão mexeu apenas na apresentação.
 */

function checks(pw: string) {
  return {
    len: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  }
}
// Chave do catálogo por regra. A ORDEM da lista é a de exibição — o checklist
// vai do requisito mais comum ao mais raro.
const RULES = ['len', 'lower', 'upper', 'digit', 'special'] as const

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

export function AuthForm({
  initialMode = 'signin',
}: {
  initialMode?: 'signin' | 'signup'
}): React.JSX.Element {
  const t = useTranslations('auth')
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
  // Token do Turnstile (null enquanto não resolvido, ou quando o captcha está
  // desligado — sem NEXT_PUBLIC_TURNSTILE_SITE_KEY o widget não renderiza).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Token é de uso único: incrementar isto força o widget a gerar outro.
  const [captchaNonce, setCaptchaNonce] = useState(0)

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
    if (!email.trim()) {
      setMsg(t('emailFirst'))
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setErr(error ? error.message : null)
    if (!error) setMsg(t('resetSent'))
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setErr(null)
    setMsg(null)
    setSubmitting(true)
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, ...(captchaToken ? { captchaToken } : {}) },
        })
        if (error) throw error
        const { data } = await supabase.auth.getSession()
        if (data.session) router.push('/conta/visao-geral/visao-geral')
        else setMsg(t('confirmEmail'))
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          ...(captchaToken ? { options: { captchaToken } } : {}),
        })
        if (error) throw error
        router.push('/conta/visao-geral/visao-geral')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('genericError'))
    } finally {
      setSubmitting(false)
      // Um token do Turnstile só vale uma vez — descarta e pede outro.
      if (isCaptchaEnabled()) setCaptchaNonce((n) => n + 1)
    }
  }

  const inputCls =
    'w-full rounded-[10px] px-3 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[var(--ink-faint)]'
  const inputStyle: React.CSSProperties = {
    background: 'var(--raised)',
    border: '1px solid var(--hairline-strong)',
    color: 'var(--ink)',
  }
  const labelCls = 'text-[13.5px] font-medium'

  return (
    <div className="flex w-full max-w-[384px] flex-col gap-6">
      {/* Cabeçalho igual ao do app: círculo azul com a marca em branco + o
          wordmark em Playfair itálico. */}
      <Link href="/" className="flex items-center gap-3 self-center">
        <span
          className="grid size-12 place-items-center rounded-full text-white"
          style={{ background: 'linear-gradient(to top, #1e40af, #2563eb)' }}
        >
          <AxiomaMark className="size-7" />
        </span>
        <span className="font-brand text-[30px] leading-none tracking-tight" style={{ color: 'var(--ink)' }}>
          Axyoma
        </span>
      </Link>

      <div
        className="gb-glass-thick rounded-[14px] p-6"
        style={{ border: '1px solid var(--hairline)' }}
      >
        <div className="mb-6 text-center">
          <h1 className="text-[20px] font-semibold tracking-[-0.015em]">
            {isSignup ? t('signupTitle') : t('signinTitle')}
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            {isSignup ? t('signupSubtitle') : t('signinSubtitle')}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {!isSignup && (
            <>
              {/* APPLE: o provedor ainda NÃO está configurado no Supabase — o
                  botão existia e devolvia erro. Botão de login que falha é pior
                  que ausência: a pessoa conclui que a conta dela é que está com
                  problema. Devolver este bloco quando o Sign in with Apple
                  estiver ativo (exige Apple Developer Program pago + Service ID
                  + chave de assinatura). O `AppleIcon` e o tipo `'apple'` em
                  `oauth()` ficam no lugar de propósito, para a volta ser só
                  descomentar. */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => oauth('google')}
                  className="gb-btn gb-btn-ghost w-full py-2.5 text-[14px]"
                >
                  <GoogleIcon /> {t('google')}
                </button>
              </div>

              {/* Separador com o rótulo sobre a linha, como no app. */}
              <div className="relative text-center">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-1/2 h-px"
                  style={{ background: 'var(--hairline-strong)' }}
                />
                <span
                  className="relative px-3 text-[12.5px]"
                  style={{ background: 'var(--mat-thick)', color: 'var(--ink-muted)' }}
                >
                  {t('orContinue')}
                </span>
              </div>
            </>
          )}

          {isSignup && (
            <div className="flex flex-col gap-2">
              <label className={labelCls} htmlFor="name">
                {t('name')}
              </label>
              <input
                id="name"
                className={inputCls}
                style={inputStyle}
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className={labelCls} htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              className={inputCls}
              style={inputStyle}
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <label className={labelCls} htmlFor="password">
                {t('password')}
              </label>
              {!isSignup && (
                <button
                  type="button"
                  onClick={reset}
                  className="ml-auto text-[13.5px] underline-offset-4 hover:underline"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {t('forgot')}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className={`${inputCls} pr-10`}
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? t('hidePassword') : t('showPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-[var(--ink)]"
                style={{ color: 'var(--ink-faint)' }}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {isSignup && (
            <>
              <div className="flex flex-col gap-2">
                <label className={labelCls} htmlFor="confirm">
                  {t('confirm')}
                </label>
                <input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  className={inputCls}
                  style={inputStyle}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={confirm.length > 0 && !match}
                  required
                />
                {confirm.length > 0 && !match && (
                  <p className="text-[12px]" style={{ color: '#b42318' }}>
                    {t('mismatch')}
                  </p>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {RULES.map((k) => (
                  <li
                    key={k}
                    className="flex items-center gap-2 text-[12px]"
                    style={{ color: c[k] ? '#15803d' : 'var(--ink-faint)' }}
                  >
                    {c[k] ? <Check className="size-3.5" /> : <X className="size-3.5" />}{' '}
                    {t(`rule${k[0].toUpperCase()}${k.slice(1)}`)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {err && (
            <p className="text-[12.5px]" style={{ color: '#b42318' }}>
              {err}
            </p>
          )}
          {msg && (
            <p className="text-[12.5px]" style={{ color: '#15803d' }}>
              {msg}
            </p>
          )}

          <Turnstile onToken={setCaptchaToken} resetKey={captchaNonce} />

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="gb-btn gb-btn-primary w-full py-2.5 text-[14px] disabled:opacity-50"
            >
              {submitting
                ? isSignup
                  ? t('creating')
                  : t('signingIn')
                : isSignup
                  ? t('signup')
                  : t('signin')}
            </button>
            <p className="text-center text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
              {isSignup ? t('hasAccount') : t('noAccount')}
              <button
                type="button"
                className="underline underline-offset-4"
                style={{ color: 'var(--ink)' }}
                onClick={() => {
                  setMode(isSignup ? 'signin' : 'signup')
                  setErr(null)
                  setMsg(null)
                }}
              >
                {isSignup ? t('toSignin') : t('toSignup')}
              </button>
            </p>
          </div>
        </form>
      </div>

      <p className="px-6 text-center text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        {t.rich('terms', {
          termos: (chunks) => (
            <Link href="/termos" className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
          privacidade: (chunks) => (
            <Link href="/privacidade" className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  )
}
