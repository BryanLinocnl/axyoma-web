'use client'

import { Wallet } from 'lucide-react'
import { useConta } from '@/lib/conta-context'
import { creditsToBRL } from '@/lib/credits'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BuyCreditsPanel } from '@/components/faturamento/buy-credits-panel'
import { InvoiceHistory } from '@/components/faturamento/invoice-history'
import { PlansSection } from '@/components/faturamento/plans-section'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export default function FaturamentoPage(): React.JSX.Element {
  const { balance, plan, token, creditBrl } = useConta()

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold">Plano atual</p>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500">{plan}</Badge>
          </div>
          <div className="border-border bg-background flex items-center gap-3 rounded-xl border p-4">
            <Wallet className="size-5 text-amber-500" />
            <div>
              <p className="text-xl font-semibold">{fmt(balance)} créditos</p>
              <p className="text-muted-foreground text-xs">≈ R$ {fmt(creditsToBRL(balance, creditBrl))} · saldo atual</p>
            </div>
          </div>
        </Card>

        <BuyCreditsPanel token={token} creditBrl={creditBrl} />
      </div>

      <InvoiceHistory />

      <PlansSection />
    </div>
  )
}
