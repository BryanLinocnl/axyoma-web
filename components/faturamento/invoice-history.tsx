'use client'

import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import { creditsToBRL } from '@/lib/credits'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Schema de `credit_purchases` confirmado via introspecção do PostgREST
// (colunas existentes checadas uma a uma; não há acesso de service-role neste
// agente): id, user_id, credits, amount_cents, status, provider, external_id,
// created_at, paid_at. `amount_cents` é assumido como o valor pago em
// centavos de BRL (consistente com `provider` guardando o gateway usado).
type PurchaseRow = {
  id: string
  credits: number
  amount_cents: number | null
  status: string | null
  provider: string | null
  created_at: string
  paid_at: string | null
}

const PAGE_SIZE = 20

// Ambos os gateways confirmados cobram via PIX hoje (a function `asaas-create-
// payment` cria a cobrança com `billingType: 'PIX'` — cartão real ainda não
// está habilitado no backend). Rótulo reflete isso, não "Cartão".
const PROVIDER_LABEL: Record<string, string> = {
  abacatepay: 'Pix (AbacatePay)',
  asaas: 'Pix (Asaas)',
}

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pago', className: 'border-emerald-500/40 text-emerald-500' },
  completed: { label: 'Pago', className: 'border-emerald-500/40 text-emerald-500' },
  pending: { label: 'Pendente', className: 'border-amber-500/40 text-amber-500' },
  processing: { label: 'Processando', className: 'border-amber-500/40 text-amber-500' },
  failed: { label: 'Falhou', className: 'border-destructive/40 text-destructive' },
  expired: { label: 'Expirado', className: 'border-destructive/40 text-destructive' },
  canceled: { label: 'Cancelado', className: 'border-border text-muted-foreground' },
  cancelled: { label: 'Cancelado', className: 'border-border text-muted-foreground' },
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatusBadge({ status }: { status: string | null }): React.JSX.Element {
  const key = (status ?? '').toLowerCase()
  const cfg = STATUS_VARIANT[key] ?? { label: status ?? '—', className: 'border-border text-muted-foreground' }
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  )
}

export function InvoiceHistory(): React.JSX.Element {
  const { userId, purchased, balance, creditBrl } = useConta()
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [canceling, setCanceling] = useState<Set<string>>(new Set())

  // Cancela uma compra PENDENTE. A RLS só permite pending→canceled do próprio
  // usuário (policy `credit_purchases_cancel_own`). Otimista, reverte no erro.
  async function cancelPurchase(id: string): Promise<void> {
    setCanceling((s) => new Set(s).add(id))
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'canceled' } : r)))
    const { error } = await supabase
      .from('credit_purchases')
      .update({ status: 'canceled' })
      .eq('id', id)
      .eq('status', 'pending')
    if (error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)))
      alert('Não foi possível cancelar. Tente novamente.')
    }
    setCanceling((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase
      .from('credit_purchases')
      .select('id, credits, amount_cents, status, provider, created_at, paid_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .then(({ data }) => {
        if (cancelled) return
        const r = (data as PurchaseRow[]) ?? []
        setRows(r)
        setHasMore(r.length === PAGE_SIZE)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  async function loadMore(): Promise<void> {
    setLoadingMore(true)
    const { data } = await supabase
      .from('credit_purchases')
      .select('id, credits, amount_cents, status, provider, created_at, paid_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(rows.length, rows.length + PAGE_SIZE - 1)
    const more = (data as PurchaseRow[]) ?? []
    setRows((prev) => [...prev, ...more])
    setHasMore(more.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  // Consumo total = comprado − saldo atual. Reaproveita `credits`/`credit_purchases`
  // já carregados pelo ContaProvider em vez de somar `usage_log` linha a linha
  // de novo (a tabela detalhada de uso/consumo já vive na página "Uso").
  const totalSpent = Math.max(0, purchased - balance)

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="text-muted-foreground size-4" /> Fatura · histórico de compras
        </div>
        <p className="text-muted-foreground text-xs">
          Consumido: {fmt(totalSpent)} créditos (≈ R$ {fmt(creditsToBRL(totalSpent, creditBrl))})
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma compra ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Método</TableHead>
                  <TableHead className="text-muted-foreground text-right">Créditos</TableHead>
                  <TableHead className="text-muted-foreground text-right">Valor</TableHead>
                  <TableHead className="text-muted-foreground text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{fmtDate(r.paid_at ?? r.created_at)}</TableCell>
                    <TableCell>{PROVIDER_LABEL[r.provider ?? ''] ?? (r.provider ?? '—')}</TableCell>
                    <TableCell className="text-right">+{fmt(Number(r.credits))}</TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {r.amount_cents != null ? `R$ ${fmt(r.amount_cents / 100)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(r.status ?? '').toLowerCase() === 'pending' && (
                          <button
                            onClick={() => void cancelPurchase(r.id)}
                            disabled={canceling.has(r.id)}
                            className="text-muted-foreground hover:text-destructive text-xs underline underline-offset-2 disabled:opacity-50"
                          >
                            {canceling.has(r.id) ? '…' : 'Cancelar'}
                          </button>
                        )}
                        <StatusBadge status={r.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground mt-4 w-full rounded-lg border py-2 text-sm transition-colors disabled:opacity-60"
            >
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </Card>
  )
}
