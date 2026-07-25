'use client'

import { useEffect, useRef, useState } from 'react'

// Widget do Cloudflare Turnstile para as telas de login/cadastro.
//
// POR QUE: o cadastro é a última porta aberta do produto. Depois da reserva
// atômica de crédito, do teto diário e do gate de e-mail confirmado, o que
// sobra é criar contas em massa — cada uma com o bônus inicial. Um captcha
// invisível na criação de conta fecha isso, e de quebra segura flood de
// tentativas de login.
//
// DESLIGADO ATÉ TER CHAVE: sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` o componente não
// renderiza nada e devolve `null` como token — os formulários seguem exatamente
// como hoje. Para ligar:
//   1. Cloudflare → Turnstile → criar site (grátis) → copiar as duas chaves;
//   2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na Vercel (a pública, do browser);
//   3. Supabase → Authentication → Attack Protection → CAPTCHA: provider
//      Turnstile + a chave SECRETA. É o Supabase que VALIDA o token; sem esse
//      passo o token vai junto e é ignorado.
// Só depois do passo 3 o captcha vira obrigatório de fato.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
    }
  }
}

export function isCaptchaEnabled(): boolean {
  return Boolean(SITE_KEY)
}

/**
 * Renderiza o widget e entrega o token por `onToken`. O token é de uso único:
 * quem chama deve pedir `reset` (via `resetKey`) depois de cada tentativa.
 */
export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void
  resetKey?: number
}): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  // Carrega o script uma vez por página.
  useEffect(() => {
    if (!SITE_KEY) return
    if (window.turnstile) {
      setReady(true)
      return
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => setReady(true))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.dataset.turnstile = 'true'
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!SITE_KEY || !ready || !ref.current || widgetId.current) return
    widgetId.current = window.turnstile!.render(ref.current, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only', // invisível salvo quando há suspeita
      callback: (token: string) => onToken(token),
      'error-callback': () => onToken(null),
      'expired-callback': () => onToken(null),
    })
  }, [ready, onToken])

  // Token é de uso único: some depois de cada submit.
  useEffect(() => {
    if (resetKey === undefined || !widgetId.current || !window.turnstile) return
    window.turnstile.reset(widgetId.current)
    onToken(null)
  }, [resetKey, onToken])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center" />
}
