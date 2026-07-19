'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import { KpiCards } from '@/components/uso/kpi-cards'
import { CreditsChart } from '@/components/uso/credits-chart'
import { ModelRanking } from '@/components/uso/model-ranking'
import { SubAgentSection } from '@/components/uso/subagent-section'
import { UsoTable } from '@/components/uso/uso-table'
import type { UsageChartPoint } from '@/components/usage-chart'
import type { UsoLogRow } from '@/components/uso/types'

const SELECT_COLUMNS = 'ts, model, credits, kind, prompt_tokens, completion_tokens'
const FETCH_BATCH = 1000
// Trava de segurança: carrega no máximo ~50k linhas (50 páginas) do usage_log
// do usuário para calcular os agregados desta página inteiramente no client
// (não há RPC de agregação por usuário hoje). Suficiente para o volume atual;
// se algum usuário estourar isso, os agregados passam a refletir só as
// entradas mais recentes até esse limite.
const MAX_BATCHES = 50
const CHART_DAYS_BACK = 90
const DAY_MS = 864e5

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function buildChartData(rows: UsoLogRow[]): UsageChartPoint[] {
  const byDay = new Map<string, number>()
  for (const r of rows) {
    const key = dayKey(r.ts)
    byDay.set(key, (byDay.get(key) ?? 0) + Number(r.credits))
  }
  const points: UsageChartPoint[] = []
  for (let i = CHART_DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS)
    const key = d.toISOString().slice(0, 10)
    points.push({ date: key, credits: byDay.get(key) ?? 0 })
  }
  return points
}

export default function UsoPage(): React.JSX.Element {
  const { userId } = useConta()
  const [rows, setRows] = useState<UsoLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadAll(): Promise<void> {
      const all: UsoLogRow[] = []
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const { data } = await supabase
          .from('usage_log')
          .select(SELECT_COLUMNS)
          .eq('user_id', userId)
          .order('ts', { ascending: false })
          .range(batch * FETCH_BATCH, batch * FETCH_BATCH + FETCH_BATCH - 1)
        const page = (data as UsoLogRow[]) ?? []
        all.push(...page)
        if (page.length < FETCH_BATCH) break
      }
      if (cancelled) return
      setRows(all)
      setNow(Date.now())
      setLoading(false)
    }

    void loadAll()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando…</p>
  }

  const today = new Date(now).toISOString().slice(0, 10)
  const creditsToday = rows.filter((r) => dayKey(r.ts) === today).reduce((a, r) => a + Number(r.credits), 0)
  const credits30d = rows.filter((r) => now - new Date(r.ts).getTime() < 30 * DAY_MS).reduce((a, r) => a + Number(r.credits), 0)
  const creditsTotal = rows.reduce((a, r) => a + Number(r.credits), 0)

  return (
    <div>
      <KpiCards creditsToday={creditsToday} credits30d={credits30d} creditsTotal={creditsTotal} generations={rows.length} />

      <div className="mb-6">
        <CreditsChart data={buildChartData(rows)} />
      </div>

      <div className="mb-6">
        <ModelRanking rows={rows} />
      </div>

      <div className="mb-6">
        <SubAgentSection rows={rows} />
      </div>

      <UsoTable rows={rows} />
    </div>
  )
}
