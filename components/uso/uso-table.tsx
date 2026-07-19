'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { UsoLogRow } from './types'

const PAGE_SIZE = 50

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

// Tabela detalhada (paginada) do histórico bruto. `rows` já vem carregado por
// inteiro do usage_log do usuário (ver page.tsx) — "carregar mais" só revela
// mais itens já em memória, sem round-trip extra ao banco.
export function UsoTable({ rows }: { rows: UsoLogRow[] }): React.JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const shown = rows.slice(0, visible)
  const hasMore = visible < rows.length

  return (
    <Card className="p-6">
      <p className="mb-4 text-sm font-semibold">Histórico ({rows.length})</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum uso ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Modelo</TableHead>
                <TableHead className="text-muted-foreground text-right">Tokens</TableHead>
                <TableHead className="text-muted-foreground text-right">Créditos</TableHead>
                <TableHead className="text-muted-foreground text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.model ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-right">{fmt((r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0))}</TableCell>
                  <TableCell className="text-right">−{fmt(Number(r.credits))}</TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {new Date(r.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {hasMore && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground mt-4 w-full rounded-lg border py-2 text-sm transition-colors"
        >
          Carregar mais
        </button>
      )}
    </Card>
  )
}
