'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import type { UsoModelo } from '@/lib/uso-por-fonte'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** 262.169.636 → "262,2 M". Token em número cheio não cabe na barra. */
function fmtCompacto(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} B`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} M`
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} k`
  return fmt(n)
}

type Campo = 'creditos' | 'chamadas' | 'tokens'

function RankingList({
  items,
  campo,
  unit,
  compacto,
}: {
  items: UsoModelo[]
  campo: Campo
  unit: string
  compacto?: boolean
}): React.JSX.Element {
  const max = items.length > 0 ? Math.max(...items.map((i) => i[campo])) : 0
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={`${item.modelo}|${item.fonte}`} className="flex items-center gap-3">
          <span className="text-muted-foreground w-4 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono text-xs">{item.modelo}</span>
                {/* Marca só o BYOK: o Axyoma é o caso comum, e um selo em toda
                    linha vira ruído em vez de sinal. */}
                {item.fonte === 'byok' && (
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[10px] leading-none"
                    style={{ background: 'color-mix(in oklab, var(--chart-2) 15%, transparent)' }}
                  >
                    sua chave
                  </span>
                )}
              </span>
              <span className="text-xs whitespace-nowrap tabular-nums">
                {compacto ? fmtCompacto(item[campo]) : fmt(item[campo])}{' '}
                <span className="text-muted-foreground">{unit}</span>
              </span>
            </div>
            <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: max > 0 ? `${(item[campo] / max) * 100}%` : '0%',
                  background: item.fonte === 'byok' ? 'var(--chart-2)' : 'var(--chart-1)',
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Modelos mais usados — UMA lista, com tudo.
 *
 * Eram dois cards, "por créditos" e "por tokens". A divisão não se sustentava:
 * separar por FORMA DE PAGAMENTO não responde a pergunta que a tela levanta
 * ("o que eu mais uso?"), e produzia um efeito colateral confuso — um modelo
 * usado pelos dois lados, como o `grok-4.5`, aparecia nos dois cards com
 * números diferentes, e parecia erro.
 *
 * Uma lista só, ordenada por TOKENS, que é a única medida em que Axyoma e BYOK
 * são comparáveis. O crédito continua visível em cada linha, quando existe.
 */
const TOPO = 8

export function ModelRanking({ rows }: { rows: UsoModelo[] }): React.JSX.Element {
  const top = useMemo(() => [...rows].sort((a, b) => b.tokens - a.tokens).slice(0, TOPO), [rows])
  const temByok = useMemo(() => rows.some((r) => r.fonte === 'byok'), [rows])

  if (rows.length === 0) {
    return (
      <Card className="p-6">
        <p className="mb-1 text-sm font-semibold">Modelos mais usados</p>
        <p className="text-muted-foreground text-sm">Nenhum uso ainda.</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Modelos mais usados</p>
        <p className="text-muted-foreground text-xs">
          por tokens{temByok ? ' · Axyoma e chave própria' : ''}
        </p>
      </div>
      <RankingList items={top} campo="tokens" unit="tokens" compacto />
    </Card>
  )
}
