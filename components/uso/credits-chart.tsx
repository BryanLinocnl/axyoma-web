'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { UsageChartPoint } from '@/components/usage-chart'

// Mesmo visual do <UsageChart> (visão-geral), mas sem a conversão para R$: P2
// foca em consumo de créditos, não em custo monetário.
const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

const chartConfig = {
  credits: { label: 'Créditos', color: 'var(--chart-1)' },
} satisfies ChartConfig

function CreditsTooltip({ active, payload }: { active?: boolean; payload?: { payload: UsageChartPoint }[] }): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const date = new Date(point.date)
  return (
    <div className="border-border/50 bg-background grid min-w-36 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-medium">
        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-[2px]" style={{ background: 'var(--chart-1)' }} />
        {fmt(point.credits)} créditos
      </span>
    </div>
  )
}

export function CreditsChart({ data }: { data: UsageChartPoint[] }): React.JSX.Element {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range]
    return data.slice(-days)
  }, [data, range])

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Consumo diário</CardTitle>
          <CardDescription>Créditos consumidos por dia</CardDescription>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as '7d' | '30d' | '90d')}>
          <SelectTrigger className="w-[140px] rounded-lg sm:ml-auto" aria-label="Selecionar período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">Últimos 90 dias</SelectItem>
            <SelectItem value="30d" className="rounded-lg">Últimos 30 dias</SelectItem>
            <SelectItem value="7d" className="rounded-lg">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="fillCreditsUso" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-credits)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-credits)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            />
            <ChartTooltip cursor={false} content={<CreditsTooltip />} />
            <Area dataKey="credits" type="natural" fill="url(#fillCreditsUso)" stroke="var(--color-credits)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
