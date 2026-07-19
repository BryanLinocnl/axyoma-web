'use client'

import { useMemo, useState } from 'react'
import { ArrowUpIcon, ArrowDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type UsageLogRow = {
  model: string | null
  kind: string | null
  credits: number
  prompt_tokens: number
  completion_tokens: number
}

const USE_CASE_LABELS: Record<string, string> = {
  chat: 'Chat',
  plan_mode: 'Plan Mode',
  code_mode: 'Code Mode',
  design_mode: 'Design Mode',
  skill: 'Skill',
  vision: 'Visão Computacional',
  image_generation: 'Geração de Imagens',
}

function labelForKind(kind: string | null): string {
  if (!kind) return 'Chat'
  // Nunca expor valores brutos de provedor de infra (ex.: nome do gateway) na
  // UI — qualquer `kind` não mapeado cai em "Geração".
  return USE_CASE_LABELS[kind] ?? 'Geração'
}

type Row = { model: string; useCase: string; calls: number; tokens: number; credits: number }
type SortKey = 'model' | 'useCase' | 'calls' | 'tokens' | 'credits'

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
        className={cn('text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors', className?.includes('text-right') && 'justify-end')}
      >
        {label}
        {active && (sortDir === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </button>
    </TableHead>
  )
}

function aggregate(rows: UsageLogRow[]): Row[] {
  const map = new Map<string, Row>()
  for (const r of rows) {
    const model = r.model ?? '—'
    const useCase = labelForKind(r.kind)
    const key = `${model}::${useCase}`
    const existing = map.get(key)
    const tokens = (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0)
    if (existing) {
      existing.calls += 1
      existing.tokens += tokens
      existing.credits += Number(r.credits)
    } else {
      map.set(key, { model, useCase, calls: 1, tokens, credits: Number(r.credits) })
    }
  }
  return [...map.values()]
}

export function ModelsUsageTable({ rows }: { rows: UsageLogRow[] }): React.JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('credits')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  const aggregated = useMemo(() => aggregate(rows), [rows])

  const sorted = useMemo(() => {
    const copy = [...aggregated]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [aggregated, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

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
        <p className="text-muted-foreground text-xs">{aggregated.length} combinação{aggregated.length === 1 ? '' : 'ões'}</p>
      </div>
      {aggregated.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum uso ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Modelo" sortKeyName="model" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Caso de uso" sortKeyName="useCase" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Chamadas" sortKeyName="calls" className="text-right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Tokens" sortKeyName="tokens" className="text-right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Créditos" sortKeyName="credits" className="text-right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={`${r.model}::${r.useCase}`}>
                    <TableCell className="font-mono text-xs">{r.model}</TableCell>
                    <TableCell className="text-muted-foreground">{r.useCase}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{fmt(r.calls)}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{fmt(r.tokens)}</TableCell>
                    <TableCell className="text-right">{fmt(r.credits)}</TableCell>
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
