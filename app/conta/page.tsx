'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  LogOut,
  Download,
  Wallet,
  CalendarDays,
  TrendingUp,
  BadgeCheck,
} from 'lucide-react'
import { supabase, SUPABASE_URL } from '@/lib/supabase-browser'
import { AxiomaLogo } from '@/components/AxiomaLogo'

type UsageRow = { ts: string; model: string | null; credits: number; kind: string; prompt_tokens: number; completion_tokens: number }

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}
function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export default function ContaPage(): React.JSX.Element {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [balance, setBalance] = useState(0)
  const [purchased, setPurchased] = useState(0)
  const [plan, setPlan] = useState('Free')
  const [rows, setRows] = useState<UsageRow[]>([])
  const [buying, setBuying] = useState(false)
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    const user = sess.session?.user
    if (!user) {
      router.replace('/login')
      return
    }
    setEmail(user.email ?? '')
    const [profileRes, credRes, subRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase.from('credits').select('balance, total_purchased').eq('user_id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('status, plans(name)').eq('owner_user_id', user.id).eq('status', 'active').maybeSingle(),
      supabase.from('usage_log').select('ts, model, credits, kind, prompt_tokens, completion_tokens').eq('user_id', user.id).order('ts', { ascending: false }).limit(300),
    ])
    setName(profileRes.data?.full_name ?? '')
    setBalance(Number(credRes.data?.balance ?? 0))
    setPurchased(Number(credRes.data?.total_purchased ?? 0))
    setPlan((subRes.data as { plans?: { name?: string } } | null)?.plans?.name ?? 'Free')
    setRows((usageRes.data as UsageRow[]) ?? [])
    setNow(Date.now())
    setLoading(false)
  }, [router])

  // Fetch de sessão + agregados ao montar (cliente).
  useEffect(() => {
    // Client-only data load on mount; setState happens after async I/O.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client data fetch
    void load()
  }, [load])

  async function buyCredits(): Promise<void> {
    setBuying(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const res = await fetch(`${SUPABASE_URL}/functions/v1/abacatepay-create-checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: 'credits-100' }),
      })
      const json = await res.json().catch(() => null)
      if (json?.url) window.open(json.url as string, '_blank')
      else alert(json?.error ?? 'Falha ao criar checkout.')
    } finally {
      setBuying(false)
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">Carregando…</main>
  }

  // Agregações (now capturado ao carregar dados)
  const today = new Date(now).toISOString().slice(0, 10)
  const spentToday = rows.filter((r) => dayKey(r.ts) === today).reduce((a, r) => a + Number(r.credits), 0)
  const spent30 = rows.filter((r) => now - new Date(r.ts).getTime() < 30 * 864e5).reduce((a, r) => a + Number(r.credits), 0)

  // Últimos 14 dias (custo diário)
  const days: { label: string; total: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 864e5)
    const key = d.toISOString().slice(0, 10)
    const total = rows.filter((r) => dayKey(r.ts) === key).reduce((a, r) => a + Number(r.credits), 0)
    days.push({ label: String(d.getDate()), total })
  }
  const maxDay = Math.max(0.001, ...days.map((d) => d.total))

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/50 p-4 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2">
          <AxiomaLogo id="side" className="h-7 w-7" />
          <span className="font-brand text-lg italic">Axyoma</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          <a href="#visao" className="flex items-center gap-2.5 rounded-lg bg-neutral-800 px-3 py-2 font-medium"><LayoutDashboard className="size-4" /> Visão geral</a>
          <a href="#uso" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"><Receipt className="size-4" /> Uso</a>
          <a href="#docs" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"><BookOpen className="size-4" /> Documentação</a>
        </nav>
        <button onClick={signOut} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100">
          <LogOut className="size-4" /> Sair
        </button>
      </aside>

      {/* Main */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Olá, {name || email.split('@')[0]}</h1>
            <p className="text-sm text-neutral-400">{email}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs">
            <BadgeCheck className="size-3.5 text-amber-500" /> Plano {plan}
          </div>
        </div>

        {/* KPIs */}
        <section id="visao" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={<Wallet className="size-4" />} label="Saldo" value={fmt(balance)} sub={`≈ R$ ${fmt(balance * 0.3)}`} accent />
          <Kpi icon={<CalendarDays className="size-4" />} label="Gasto hoje" value={fmt(spentToday)} sub="créditos" />
          <Kpi icon={<TrendingUp className="size-4" />} label="Gasto (30d)" value={fmt(spent30)} sub="créditos" />
          <Kpi icon={<Receipt className="size-4" />} label="Total comprado" value={fmt(purchased)} sub="créditos" />
        </section>

        {/* Comprar + custo diário */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div>
              <p className="text-sm text-neutral-400">Precisa de mais?</p>
              <p className="mt-1 text-lg font-semibold">Comprar créditos</p>
              <p className="mt-1 text-xs text-neutral-500">Pague via PIX. 1 crédito = R$ 0,30.</p>
            </div>
            <button onClick={buyCredits} disabled={buying} className="brand-gradient mt-5 rounded-full py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-60">
              {buying ? 'Abrindo…' : 'Comprar créditos'}
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 lg:col-span-2">
            <p className="mb-4 text-sm font-semibold">Custo diário (14 dias)</p>
            <div className="flex h-32 items-end gap-1.5">
              {days.map((d, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-amber-600/40 to-amber-400 transition-all"
                      style={{ height: `${Math.max(2, (d.total / maxDay) * 100)}%` }}
                      title={`${fmt(d.total)} créditos`}
                    />
                  </div>
                  <span className="text-[10px] text-neutral-500">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Uso recente */}
        <section id="uso" className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="mb-4 text-sm font-semibold">Uso recente</p>
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum uso ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-neutral-500">
                  <tr className="border-b border-neutral-800">
                    <th className="pb-2 font-medium">Modelo</th>
                    <th className="pb-2 text-right font-medium">Tokens</th>
                    <th className="pb-2 text-right font-medium">Créditos</th>
                    <th className="hidden pb-2 text-right font-medium sm:table-cell">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/70">
                  {rows.slice(0, 12).map((r, i) => (
                    <tr key={i} className="text-neutral-300">
                      <td className="py-2.5 font-mono text-xs">{r.model ?? r.kind}</td>
                      <td className="py-2.5 text-right text-neutral-400">{fmt((r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0))}</td>
                      <td className="py-2.5 text-right">−{fmt(Number(r.credits))}</td>
                      <td className="hidden py-2.5 text-right text-neutral-500 sm:table-cell">
                        {new Date(r.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Documentação */}
        <section id="docs" className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="mb-4 text-sm font-semibold">Documentação</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { t: 'Começando', d: 'Instale e faça login.', href: '/docs' },
              { t: 'Créditos', d: 'Como funciona a cobrança.', href: '/docs' },
              { t: 'Os três modos', d: 'Design, Plan e Code.', href: '/docs' },
            ].map((doc) => (
              <a key={doc.t} href={doc.href} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition-colors hover:border-neutral-700">
                <p className="text-sm font-medium">{doc.t}</p>
                <p className="mt-1 text-xs text-neutral-500">{doc.d}</p>
              </a>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between text-sm text-neutral-500">
          <Link href="/download" className="flex items-center gap-1.5 text-amber-500 hover:underline">
            <Download className="size-4" /> Baixar o app
          </Link>
          <button onClick={signOut} className="md:hidden">Sair</button>
        </div>
      </main>
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
        <span className="text-neutral-500">{icon}</span> {label}
      </div>
      <p className={`text-2xl font-semibold ${accent ? 'brand-text' : ''}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
    </div>
  )
}
