'use client'

import { useEffect, useState } from 'react'
import { Wallet, CalendarDays, TrendingUp, Receipt, Activity, Hourglass } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import { creditsToBRL } from '@/lib/credits'
import { Card } from '@/components/ui/card'
import { UsageChart, type UsageChartPoint } from '@/components/usage-chart'
import { ModelsUsageTable, type UsageLogRow } from '@/components/models-usage-table'
import { BuyCreditsCard } from '@/components/dashboard/BuyCreditsCard'
import { DownloadCard } from '@/components/dashboard/DownloadCard'

type Row = UsageLogRow & { ts: string }

const DAYS_BACK = 90

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}
function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function buildChartData(rows: Row[]): UsageChartPoint[] {
  const byDay = new Map<string, number>()
  for (const r of rows) {
    const key = dayKey(r.ts)
    byDay.set(key, (byDay.get(key) ?? 0) + Number(r.credits))
  }
  const points: UsageChartPoint[] = []
  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5)
    const key = d.toISOString().slice(0, 10)
    points.push({ date: key, credits: byDay.get(key) ?? 0 })
  }
  return points
}

export default function ContaOverviewPage(): React.JSX.Element {
  const { userId, balance, purchased, token, creditBrl } = useConta()
  const [rows, setRows] = useState<Row[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const since = new Date(Date.now() - DAYS_BACK * 864e5).toISOString()
    void supabase
      .from('usage_log')
      .select('ts, model, credits, kind, prompt_tokens, completion_tokens')
      .eq('user_id', userId)
      .gte('ts', since)
      .order('ts', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setRows((data as Row[]) ?? [])
        setNow(Date.now())
        setLoadingRows(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loadingRows) {
    return <p className="text-muted-foreground text-sm">Carregando…</p>
  }

  const today = new Date(now).toISOString().slice(0, 10)
  const spentToday = rows.filter((r) => dayKey(r.ts) === today).reduce((a, r) => a + Number(r.credits), 0)
  const spent30 = rows.filter((r) => now - new Date(r.ts).getTime() < 30 * 864e5).reduce((a, r) => a + Number(r.credits), 0)
  const avgDaily30 = spent30 / 30
  const daysLeft = avgDaily30 > 0 ? balance / avgDaily30 : null

  return (
    <div>
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <BuyCreditsCard token={token} creditBrl={creditBrl} />
        <DownloadCard />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<Wallet className="size-4" />} label="Saldo" value={fmt(balance)} sub={`≈ R$ ${fmt(creditsToBRL(balance, creditBrl))}`} accent />
        <Kpi icon={<CalendarDays className="size-4" />} label="Gasto hoje" value={fmt(spentToday)} sub="créditos" />
        <Kpi icon={<TrendingUp className="size-4" />} label="Gasto (30d)" value={fmt(spent30)} sub="créditos" />
        <Kpi icon={<Receipt className="size-4" />} label="Total comprado" value={fmt(purchased)} sub="créditos" />
        <Kpi icon={<Activity className="size-4" />} label="Média diária (30d)" value={fmt(avgDaily30)} sub="créditos/dia" />
        <Kpi
          icon={<Hourglass className="size-4" />}
          label="Autonomia estimada"
          value={daysLeft === null ? '—' : daysLeft > 999 ? '999+' : fmt(daysLeft)}
          sub="dias no ritmo atual"
        />
      </section>

      <div className="mb-6">
        <UsageChart data={buildChartData(rows)} creditBrl={creditBrl} />
      </div>

      <ModelsUsageTable rows={rows} />
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
