'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import type { UsoLogRow } from './types'

type Agg = { model: string; credits: number; calls: number }

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function aggregateByModel(rows: UsoLogRow[]): Agg[] {
  const map = new Map<string, Agg>()
  for (const r of rows) {
    const model = r.model ?? '—'
    const existing = map.get(model)
    if (existing) {
      existing.credits += Number(r.credits)
      existing.calls += 1
    } else {
      map.set(model, { model, credits: Number(r.credits), calls: 1 })
    }
  }
  return [...map.values()]
}

function RankingList({ items, valueKey, unit }: { items: Agg[]; valueKey: 'credits' | 'calls'; unit: string }): React.JSX.Element {
  const max = items.length > 0 ? Math.max(...items.map((i) => i[valueKey])) : 0
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={item.model} className="flex items-center gap-3">
          <span className="text-muted-foreground w-4 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-xs">{item.model}</span>
              <span className="text-xs whitespace-nowrap tabular-nums">
                {fmt(item[valueKey])} <span className="text-muted-foreground">{unit}</span>
              </span>
            </div>
            <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: max > 0 ? `${(item[valueKey] / max) * 100}%` : '0%', background: 'var(--chart-1)' }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ModelRanking({ rows }: { rows: UsoLogRow[] }): React.JSX.Element {
  const byCredits = useMemo(() => aggregateByModel(rows).sort((a, b) => b.credits - a.credits).slice(0, 5), [rows])
  const byCalls = useMemo(() => aggregateByModel(rows).sort((a, b) => b.calls - a.calls).slice(0, 5), [rows])

  if (rows.length === 0) {
    return (
      <Card className="p-6">
        <p className="mb-1 text-sm font-semibold">Modelos mais usados</p>
        <p className="text-muted-foreground text-sm">Nenhum uso ainda.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-6">
        <p className="mb-4 text-sm font-semibold">Modelos mais usados (créditos)</p>
        <RankingList items={byCredits} valueKey="credits" unit="créditos" />
      </Card>
      <Card className="p-6">
        <p className="mb-4 text-sm font-semibold">Modelos mais usados (gerações)</p>
        <RankingList items={byCalls} valueKey="calls" unit="gerações" />
      </Card>
    </div>
  )
}
