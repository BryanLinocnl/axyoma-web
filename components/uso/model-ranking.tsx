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
 * Ranking de modelos, das DUAS fontes.
 *
 * Saía do `usage_log` e por isso listava só o que passa pelo proxy — modelo
 * rodado com chave própria não aparecia, mesmo respondendo por milhões de
 * tokens. Agora vem do rollup, que cobre as duas origens.
 *
 * O card da direita passou a ranquear por TOKENS, não por chamadas. Uma
 * chamada de agente e uma pergunta curta contam igual no número de chamadas,
 * então o pódio dizia mais sobre estilo de uso do que sobre volume — e é o
 * volume que explica a conta.
 */
export function ModelRanking({ rows }: { rows: UsoModelo[] }): React.JSX.Element {
  const porCreditos = useMemo(
    // Só o que de fato consome crédito: um modelo BYOK aqui seria uma barra
    // zerada, ocupando lugar de quem tem número para mostrar.
    () => rows.filter((r) => r.creditos > 0).sort((a, b) => b.creditos - a.creditos).slice(0, 5),
    [rows],
  )
  const porTokens = useMemo(() => [...rows].sort((a, b) => b.tokens - a.tokens).slice(0, 5), [rows])

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
        <RankingList items={porCreditos} campo="creditos" unit="créditos" />
      </Card>
      <Card className="p-6">
        <p className="mb-1 text-sm font-semibold">Modelos mais usados (tokens)</p>
        <p className="text-muted-foreground mb-4 text-xs">créditos Axyoma e chave própria</p>
        <RankingList items={porTokens} campo="tokens" unit="tokens" compacto />
      </Card>
    </div>
  )
}
