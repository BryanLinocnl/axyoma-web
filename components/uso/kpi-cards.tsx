import { FlameIcon, CalendarRangeIcon, LayersIcon, SparklesIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function KpiCards({
  creditsToday,
  credits30d,
  creditsTotal,
  generations,
}: {
  creditsToday: number
  credits30d: number
  creditsTotal: number
  generations: number
}): React.JSX.Element {
  return (
    <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi icon={<FlameIcon className="size-4" />} label="Créditos hoje" value={fmt(creditsToday)} sub="créditos" accent />
      <Kpi icon={<CalendarRangeIcon className="size-4" />} label="Créditos (30d)" value={fmt(credits30d)} sub="créditos" />
      <Kpi icon={<LayersIcon className="size-4" />} label="Créditos (total)" value={fmt(creditsTotal)} sub="créditos" />
      <Kpi icon={<SparklesIcon className="size-4" />} label="Gerações" value={fmt(generations)} sub="ao todo" />
    </section>
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
