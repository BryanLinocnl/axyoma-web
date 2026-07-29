'use client'

import { CoinsIcon, KeyRoundIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { UsoFonte } from '@/lib/uso-por-fonte'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** 262.169.636 → "262,2 M". Contagem de token em número cheio não se lê. */
function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} B`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} M`
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} k`
  return fmt(n)
}

/**
 * Uso por fonte de pagamento.
 *
 * A página mostrava só o consumo de créditos AXYOMA, porque lia apenas
 * `usage_log`. O uso com chave própria vive em outro lugar (ver
 * `lib/uso-por-fonte.ts`) e é o que aparece aqui ao lado.
 *
 * O card do BYOK NÃO mostra custo. Quem paga é a chave do usuário, na conta
 * dele no provedor, e nós não medimos esse valor — imprimir "R$ 0,00" diria
 * que foi de graça, que é falso.
 */
export function FonteSection({ fontes }: { fontes: UsoFonte[] }): React.JSX.Element | null {
  if (fontes.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Uso por fonte</h2>
        <p className="text-muted-foreground text-xs">
          {fontes.length > 1 ? 'créditos Axyoma e chave própria' : 'todas as origens'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {fontes.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs">
              {f.id === 'axyoma' ? <CoinsIcon className="size-4" /> : <KeyRoundIcon className="size-4" />}
              {f.label}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Metrica valor={fmt(f.chamadas)} rotulo="chamadas" />
              <Metrica valor={fmtTokens(f.tokens)} rotulo="tokens" />
              {f.id === 'axyoma' ? (
                <Metrica valor={fmt(f.creditos)} rotulo="créditos" destaque />
              ) : (
                <Metrica valor="—" rotulo="pago pela sua chave" />
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Metrica({
  valor,
  rotulo,
  destaque,
}: {
  valor: string
  rotulo: string
  destaque?: boolean
}): React.JSX.Element {
  return (
    <div>
      <p className={`text-xl font-semibold ${destaque ? 'brand-text' : ''}`}>{valor}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{rotulo}</p>
    </div>
  )
}
