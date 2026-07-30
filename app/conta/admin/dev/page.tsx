'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, UserPlus, Wallet, CreditCard, DollarSign, Activity,
  AlertTriangle, Timer, KeyRound, Bug, ArrowRight, ShieldAlert,
} from 'lucide-react'
import { useConta } from '@/lib/conta-context'
import { Card } from '@/components/ui/card'
import type { AdminMetrics, AdminSeriePonto } from '@/lib/supabase-admin'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function usd(n: number | null | undefined): string {
  if (n == null) return '—'
  return `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 262.169.636 → "262,2 M". Token em número cheio não se lê num KPI. */
function compacto(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} B`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} M`
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} k`
  return fmt(n)
}

function ms(n: number | null | undefined): string {
  if (n == null) return '—'
  return n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : `${n} ms`
}

export default function DevPage(): React.JSX.Element {
  const router = useRouter()
  const { loading, isAdmin, token } = useConta()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [serie, setSerie] = useState<AdminSeriePonto[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.replace('/conta/visao-geral/visao-geral')
      return
    }
    if (!token) return
    fetch('/api/admin/metrics?dias=30', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const j = (await r.json()) as { metrics?: AdminMetrics; serie?: AdminSeriePonto[]; error?: string }
        if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`)
        setMetrics(j.metrics ?? null)
        setSerie(j.serie ?? [])
      })
      .catch((e: Error) => setErro(e.message))
  }, [loading, isAdmin, token, router])

  if (loading) return <p className="text-muted-foreground text-sm">Carregando…</p>
  if (erro) return <p className="text-sm text-red-500">Erro ao carregar métricas: {erro}</p>
  if (!metrics) return <p className="text-muted-foreground text-sm">Carregando métricas…</p>

  const { usuarios, receita, custo, uso, saude } = metrics
  const taxaErro = saude.turnos_7d > 0 ? (saude.erros_7d / saude.turnos_7d) * 100 : 0

  return (
    <div className="space-y-8">
      {/* SAÚDE PRIMEIRO, e não a receita. Este painel existe para achar o que
          está quebrado: número de vendas não muda a decisão de hoje, taxa de
          erro muda. */}
      <Secao titulo="Saúde" sub="últimos 7 dias">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            icon={<AlertTriangle className="size-4" />}
            label="Taxa de erro"
            value={`${fmt(taxaErro)}%`}
            sub={`${fmt(saude.erros_7d)} de ${fmt(saude.turnos_7d)} turnos`}
            alerta={taxaErro >= 10}
          />
          <Kpi
            icon={<Timer className="size-4" />}
            label="TTFT (p95)"
            value={ms(saude.ttft_p95_ms)}
            sub={`p50 ${ms(saude.ttft_p50_ms)}`}
            alerta={(saude.ttft_p95_ms ?? 0) > 20000}
          />
          <Kpi
            icon={<Activity className="size-4" />}
            label="Abortos / teto"
            value={`${fmt(saude.abortos_7d)} / ${fmt(saude.cap_7d)}`}
            sub="usuário parou · bateu limite"
          />
          {/* Hold aberto há mais de uma hora é reserva que nunca fechou: ou o
              turno morreu sem settle, ou há crédito preso na conta de alguém. */}
          <Kpi
            icon={<ShieldAlert className="size-4" />}
            label="Reservas presas"
            value={fmt(saude.holds_presos)}
            sub="holds abertos > 1h"
            alerta={saude.holds_presos > 0}
          />
        </div>
      </Secao>

      <Secao titulo="Custo" sub="o que sai do nosso bolso">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={<DollarSign className="size-4" />} label="Custo (30d)" value={usd(custo.usd_30d)} sub="upstream, real" destaque />
          <Kpi icon={<DollarSign className="size-4" />} label="Custo (7d)" value={usd(custo.usd_7d)} sub="upstream, real" />
          {/* Consumo da equipe: não debita crédito, mas custa dinheiro. Separado
              para não inflar o custo por usuário pagante. */}
          <Kpi icon={<KeyRound className="size-4" />} label="Interno (30d)" value={usd(custo.usd_interno_30d)} sub="equipe, sem cobrança" />
          <Kpi icon={<CreditCard className="size-4" />} label="Créditos gastos" value={fmt(custo.creditos_30d)} sub="30 dias" />
        </div>
      </Secao>

      <Secao titulo="Uso" sub="30 dias">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={<Activity className="size-4" />} label="Chamadas" value={fmt(uso.chamadas_30d)} sub={`${fmt(uso.byok_chamadas_30d)} com chave própria`} />
          <Kpi icon={<Activity className="size-4" />} label="Tokens" value={compacto(uso.tokens_30d)} sub="entrada + saída" />
          <Kpi icon={<Activity className="size-4" />} label="Imagens" value={fmt(uso.imagens)} sub="geradas ao todo" />
          <Kpi icon={<Activity className="size-4" />} label="Vídeos" value={fmt(uso.videos)} sub="gerados ao todo" />
        </div>
      </Secao>

      <Secao titulo="Negócio">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={<Users className="size-4" />} label="Usuários" value={fmt(usuarios.total)} sub={`${fmt(usuarios.ativos_30d)} ativos em 30d`} />
          <Kpi icon={<UserPlus className="size-4" />} label="Novos (30d)" value={fmt(usuarios.novos_30d)} sub={`${fmt(usuarios.ativos_7d)} ativos em 7d`} />
          <Kpi icon={<CreditCard className="size-4" />} label="Assinaturas" value={fmt(receita.assinaturas_ativas)} sub={`${fmt(receita.compras)} compras de crédito`} />
          {/* Passivo: crédito vendido e ainda não consumido. */}
          <Kpi icon={<Wallet className="size-4" />} label="Saldo em circulação" value={fmt(receita.saldo_em_circulacao)} sub={`${fmt(receita.creditos_comprados)} vendidos ao todo`} />
        </div>
      </Secao>

      <SerieDiaria pontos={serie} />

      <Link
        href="/conta/admin/dev/erros"
        className="border-border hover:bg-accent flex items-center justify-between rounded-lg border px-4 py-3 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Bug className="size-4" /> Erros do agente
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          quadro de correção <ArrowRight className="size-3.5" />
        </span>
      </Link>
    </div>
  )
}

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
      </div>
      {children}
    </section>
  )
}

function Kpi({
  icon, label, value, sub, destaque, alerta,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  destaque?: boolean
  alerta?: boolean
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
        <span>{icon}</span> {label}
      </div>
      <p className={`text-2xl font-semibold ${alerta ? 'text-red-500' : destaque ? 'brand-text' : ''}`}>{value}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
    </Card>
  )
}

/**
 * Série diária em barras próprias, sem biblioteca de gráfico.
 *
 * São três medidas de escalas muito diferentes (dólar, chamadas, erros) e um
 * eixo só as achataria: com 300 chamadas e 2 erros no mesmo eixo, a linha de
 * erro fica colada no zero justamente no dia em que ela importa. Cada faixa é
 * normalizada pelo próprio máximo, e o total aparece ao lado do título.
 */
function SerieDiaria({ pontos }: { pontos: AdminSeriePonto[] }): React.JSX.Element | null {
  if (pontos.length === 0) return null
  const maxUsd = Math.max(...pontos.map((p) => Number(p.usd)), 0.0001)
  const maxCh = Math.max(...pontos.map((p) => Number(p.chamadas)), 1)
  const maxErr = Math.max(...pontos.map((p) => Number(p.erros)), 1)

  return (
    <Card className="p-6">
      <p className="mb-4 text-sm font-semibold">Últimos {pontos.length} dias</p>
      <div className="space-y-4">
        <Faixa titulo="Custo" cor="#fb860a" pontos={pontos} valor={(p) => Number(p.usd)} max={maxUsd} rotulo={usd} />
        <Faixa titulo="Chamadas" cor="#2b7fff" pontos={pontos} valor={(p) => Number(p.chamadas)} max={maxCh} rotulo={fmt} />
        <Faixa titulo="Erros" cor="#ef4444" pontos={pontos} valor={(p) => Number(p.erros)} max={maxErr} rotulo={fmt} />
      </div>
    </Card>
  )
}

function Faixa({
  titulo, cor, pontos, valor, max, rotulo,
}: {
  titulo: string
  cor: string
  pontos: AdminSeriePonto[]
  valor: (p: AdminSeriePonto) => number
  max: number
  rotulo: (v: number) => string
}): React.JSX.Element {
  const total = pontos.reduce((a, p) => a + valor(p), 0)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px]" style={{ background: cor }} />
          {titulo}
        </span>
        <span className="text-muted-foreground tabular-nums">{rotulo(total)} no período</span>
      </div>
      <div className="flex h-10 items-end gap-px">
        {pontos.map((p) => {
          const v = valor(p)
          return (
            <div
              key={p.dia}
              title={`${new Date(p.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${rotulo(v)}`}
              className="flex-1 rounded-sm"
              style={{
                // Mínimo de 2% para um dia COM valor não sumir; zero fica um
                // fio, senão o gráfico sugeriria atividade em dia parado.
                height: v > 0 ? `${Math.max(2, (v / max) * 100)}%` : '1px',
                background: v > 0 ? cor : 'var(--border)',
                opacity: v > 0 ? 1 : 0.5,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
