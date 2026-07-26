'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { FALLBACK_CREDIT_BRL, type BillingConfig } from '@/lib/credits'

type ContaState = {
  authReady: boolean
  loading: boolean
  userId: string
  email: string
  name: string
  /** Saldo GASTÁVEL: comprado + franquia. */
  balance: number
  /** Franquia de cadastro (só vale nos modelos Vertex). Parte do `balance`. */
  bonus: number
  /** Total comprado na vida (não é saldo). */
  purchased: number
  plan: string
  isAdmin: boolean
  token: string
  creditBrl: number
  reload: () => Promise<void>
  signOut: () => Promise<void>
}

const ContaContext = createContext<ContaState | null>(null)

// Cookie espelho do access token para o middleware server-side gate-ar /conta/**
// e /conta/admin/**. Não-httpOnly (setável por JS) — mesmo nível de exposição do
// localStorage onde o token já vive; SameSite=Lax + Secure limitam CSRF. Ver
// `middleware.ts` para o modelo de segurança completo.
const SESSION_COOKIE = 'axyoma-access-token'

function setSessionCookie(token: string): void {
  if (typeof document === 'undefined') return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  // Max-Age curto (1h) alinhado ao TTL típico do access token; o
  // onAuthStateChange renova a cada refresh.
  document.cookie = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=3600; SameSite=Lax${secure}`
}

function clearSessionCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function ContaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [balance, setBalance] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [purchased, setPurchased] = useState(0)
  const [plan, setPlan] = useState('Free')
  const [isAdmin, setIsAdmin] = useState(false)
  const [token, setToken] = useState('')
  const [creditBrl, setCreditBrl] = useState(FALLBACK_CREDIT_BRL)

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    const user = sess.session?.user
    const accessToken = sess.session?.access_token
    if (!user || !accessToken) {
      router.replace('/login')
      return
    }
    setUserId(user.id)
    setEmail(user.email ?? '')
    setToken(accessToken)
    setSessionCookie(accessToken)
    // Sessão confirmada → libera o render do shell IMEDIATAMENTE (LCP rápido).
    // Os dados abaixo (saldo/plano/nome) chegam depois e preenchem via skeleton.
    setAuthReady(true)

    // Bônus de cadastro: concedido pelo proxy (o valor mora na env
    // SIGNUP_BONUS_CREDITS). Precisa vir ANTES da leitura do saldo, senão o
    // primeiro acesso mostra 0 crédito. Idempotente no banco — chamar em todo
    // login não credita de novo. Falha não bloqueia: cai na leitura normal.
    const bootstrapBalance = await fetch('/api/v1/credits/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ balance?: number }>) : null))
      .then((d) => (typeof d?.balance === 'number' ? d.balance : null))
      .catch(() => null)

    const [profileRes, credRes, subRes, statusRes, billingRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      // `bonus_balance` = franquia de cadastro (só Vertex). O saldo exibido é a
      // SOMA dos dois: quem tem 400 de franquia e 0 comprado tem 400, não 0.
      supabase.from('credits').select('balance, bonus_balance, total_purchased').eq('user_id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('status, plans(name)').eq('owner_user_id', user.id).eq('status', 'active').maybeSingle(),
      fetch('/api/admin/status', { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()).catch(() => ({ isAdmin: false })),
      fetch('/api/billing/config', { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
    setName(profileRes.data?.full_name ?? '')
    // O saldo do bootstrap é o mais recente (a leitura em paralelo pode ter
    // saído antes da concessão).
    const bonusBalance = Number(credRes.data?.bonus_balance ?? 0)
    setBalance(bootstrapBalance ?? Number(credRes.data?.balance ?? 0) + bonusBalance)
    setBonus(bonusBalance)
    setPurchased(Number(credRes.data?.total_purchased ?? 0))
    setPlan((subRes.data as { plans?: { name?: string } } | null)?.plans?.name ?? 'Free')
    setIsAdmin(Boolean(statusRes?.isAdmin))
    const cfg = billingRes as BillingConfig | null
    if (cfg && typeof cfg.credit_brl === 'number' && cfg.credit_brl > 0) setCreditBrl(cfg.credit_brl)
    setLoading(false)
  }, [router])

  useEffect(() => {
    // Client-only session/data load on mount; setState happens after async I/O.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client data fetch
    void load()
  }, [load])

  useEffect(() => {
    // Mantém o cookie espelho sincronizado com o ciclo de vida da sessão para o
    // middleware server-side (refresh de token, logout em outra aba, etc.).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.access_token) {
        clearSessionCookie()
      } else {
        setSessionCookie(session.access_token)
        setToken(session.access_token)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signOut(): Promise<void> {
    clearSessionCookie()
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <ContaContext.Provider value={{ authReady, loading, userId, email, name, balance, bonus, purchased, plan, isAdmin, token, creditBrl, reload: load, signOut }}>
      {children}
    </ContaContext.Provider>
  )
}

export function useConta(): ContaState {
  const ctx = useContext(ContaContext)
  if (!ctx) throw new Error('useConta precisa estar dentro de <ContaProvider>')
  return ctx
}
