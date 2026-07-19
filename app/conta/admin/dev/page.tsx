'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, Wallet, CreditCard, CalendarDays, TrendingUp } from 'lucide-react'
import { useConta } from '@/lib/conta-context'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminMetrics } from '@/lib/supabase-admin'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export default function DevPage(): React.JSX.Element {
  const router = useRouter()
  const { loading, isAdmin, token } = useConta()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.replace('/conta/visao-geral/visao-geral')
      return
    }
    let cancelled = false
    void fetch('/api/admin/metrics', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) setError(json.error)
        else setMetrics(json as AdminMetrics)
      })
    return () => {
      cancelled = true
    }
  }, [loading, isAdmin, token, router])

  if (loading || (!isAdmin && !error)) {
    return <p className="text-muted-foreground text-sm">Carregando…</p>
  }
  if (error) {
    return <p className="text-sm text-red-400">Erro ao carregar métricas: {error}</p>
  }
  if (!metrics) {
    return <p className="text-muted-foreground text-sm">Carregando métricas…</p>
  }

  const maxDay = Math.max(0.001, ...metrics.daily_30d.map((d) => d.credits))

  return (
    <div>
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Users className="size-4" />} label="Usuários" value={fmt(metrics.total_users)} sub="total" />
        <Kpi icon={<UserPlus className="size-4" />} label="Novos (30d)" value={fmt(metrics.new_users_30d)} sub="usuários" />
        <Kpi icon={<CreditCard className="size-4" />} label="Assinaturas ativas" value={fmt(metrics.active_subscriptions)} sub="planos" />
        <Kpi icon={<Wallet className="size-4" />} label="Créditos comprados" value={fmt(metrics.total_purchased_credits)} sub="total" accent />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi icon={<CalendarDays className="size-4" />} label="Gasto hoje" value={fmt(metrics.spend_today_credits)} sub="créditos" />
        <Kpi icon={<TrendingUp className="size-4" />} label="Gasto (7d)" value={fmt(metrics.spend_7d_credits)} sub="créditos" />
        <Kpi icon={<TrendingUp className="size-4" />} label="Gasto (30d)" value={fmt(metrics.spend_30d_credits)} sub="créditos" />
      </section>

      <Card className="mb-6 p-6">
        <p className="mb-4 text-sm font-semibold">Custo diário — todos usuários (30 dias)</p>
        <div className="flex h-32 items-end gap-1">
          {metrics.daily_30d.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-amber-600/40 to-amber-400 transition-all"
                  style={{ height: `${Math.max(2, (d.credits / maxDay) * 100)}%` }}
                  title={`${fmt(d.credits)} créditos · ${d.calls} chamadas`}
                />
              </div>
              <span className="text-muted-foreground text-[9px]">{d.day.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-sm font-semibold">Gasto por modelo (30 dias)</p>
        {metrics.by_model_30d.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem dados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Modelo</TableHead>
                <TableHead className="text-muted-foreground text-right">Chamadas</TableHead>
                <TableHead className="text-muted-foreground text-right">Tokens</TableHead>
                <TableHead className="text-muted-foreground text-right">Créditos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.by_model_30d.map((m) => (
                <TableRow key={m.model ?? '—'}>
                  <TableCell className="font-mono text-xs">{m.model ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-right">{fmt(m.calls)}</TableCell>
                  <TableCell className="text-muted-foreground text-right">{fmt(m.prompt_tokens + m.completion_tokens)}</TableCell>
                  <TableCell className="text-right">{fmt(m.credits)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
        <span>{icon}</span> {label}
      </div>
      <p className={`text-2xl font-semibold ${accent ? 'brand-text' : ''}`}>{value}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
    </Card>
  )
}
