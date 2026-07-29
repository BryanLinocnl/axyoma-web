'use client'

import { useMemo, useState } from 'react'
import { ArrowUpIcon, ArrowDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { UsoModelo } from '@/lib/uso-por-fonte'

/** @deprecated shape antiga, de quando a tabela saía do `usage_log`. */
export type UsageLogRow = {
  model: string | null
  kind: string | null
  credits: number
  prompt_tokens: number
  completion_tokens: number
}

type SortKey = 'modelo' | 'fonte' | 'chamadas' | 'tokens' | 'creditos'

const PAGE_SIZE = 20

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function SortHeader({
  label,
  sortKeyName,
  className,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string
  sortKeyName: SortKey
  className?: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onToggle: (key: SortKey) => void
}): React.JSX.Element {
  const active = sortKey === sortKeyName
  return (
    <TableHead className={className}>
      <button
        onClick={() => onToggle(sortKeyName)}
        className={cn(
          'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors',
          className?.includes('text-right') && 'justify-end',
        )}
      >
        {label}
        {active && (sortDir === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </button>
    </TableHead>
  )
}

/**
 * Modelos usados, das DUAS fontes.
 *
 * A tabela saía do `usage_log` e por isso listava apenas o que passa pelo
 * proxy: os modelos rodados com chave própria não apareciam em lugar nenhum,
 * mesmo respondendo por milhões de tokens. Agora vem do rollup
 * (`lib/uso-por-fonte.ts`), que cobre as duas origens.
 *
 * A coluna "Caso de uso" saiu no lugar de "Fonte". Ela derivava do `kind`, e
 * como todo `kind` de provedor cai no genérico "Geração", a coluna repetia a
 * mesma palavra em todas as linhas. "Fonte" responde a pergunta que essa tela
 * de fato levanta: quem pagou por este modelo.
 *
 * A ordenação padrão é por TOKENS, não por créditos: por crédito, todo modelo
 * BYOK afundaria para o fim da lista — o crédito dele é zero por definição.
 */
export function ModelsUsageTable({ rows }: { rows: UsoModelo[] }): React.JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('tokens')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)
  const temByok = useMemo(() => rows.some((r) => r.fonte === 'byok'), [rows])

  function toggleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold">Modelos usados</p>
        <p className="text-muted-foreground text-xs">
          {rows.length} modelo{rows.length === 1 ? '' : 's'}
          {temByok ? ' · Axyoma e chave própria' : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum uso ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Modelo" sortKeyName="modelo" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Fonte" sortKeyName="fonte" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Chamadas" sortKeyName="chamadas" className="text-right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Tokens" sortKeyName="tokens" className="text-right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Créditos" sortKeyName="creditos" className="text-right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={`${r.modelo}::${r.fonte}`}>
                    <TableCell className="font-mono text-xs">{r.modelo}</TableCell>
                    <TableCell>
                      <FonteBadge fonte={r.fonte} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">{fmt(r.chamadas)}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{fmt(r.tokens)}</TableCell>
                    {/* Traço, não "0,00": o BYOK não custou crédito nenhum daqui,
                        e um zero se lê como "foi de graça". */}
                    <TableCell className="text-right">
                      {r.fonte === 'byok' ? <span className="text-muted-foreground">—</span> : fmt(r.creditos)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {sorted.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                Página {clampedPage + 1} de {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={clampedPage === 0}
                  className="border-border hover:bg-accent hover:text-accent-foreground rounded-md border p-1.5 disabled:opacity-40"
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={clampedPage >= totalPages - 1}
                  className="border-border hover:bg-accent hover:text-accent-foreground rounded-md border p-1.5 disabled:opacity-40"
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function FonteBadge({ fonte }: { fonte: UsoModelo['fonte'] }): React.JSX.Element {
  const axyoma = fonte === 'axyoma'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs"
      style={{
        background: `color-mix(in oklab, ${axyoma ? 'var(--chart-1)' : 'var(--chart-2)'} 12%, transparent)`,
      }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: axyoma ? 'var(--chart-1)' : 'var(--chart-2)' }}
      />
      {axyoma ? 'Axyoma' : 'Sua chave'}
    </span>
  )
}
