'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { creditsToBRL, FALLBACK_CREDIT_BRL } from '@/lib/credits'
import type { PontoDiario } from '@/lib/uso-por-fonte'

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

/**
 * Métrica plotada.
 *
 * Há um seletor, e não uma métrica fixa, porque as duas fontes NÃO são
 * comparáveis em todas elas. Em `creditos` a curva do BYOK é uma reta no zero
 * por definição: quem paga é a chave do usuário e o crédito Axyoma não é
 * debitado. Tokens e chamadas medem a mesma coisa dos dois lados — é ali que a
 * comparação diz alguma coisa, e por isso `tokens` é o padrão.
 */
type Metrica = 'tokens' | 'creditos' | 'chamadas'

const METRICAS: Record<
  Metrica,
  { label: string; descricao: string; axyoma: keyof PontoDiario; byok: keyof PontoDiario }
> = {
  tokens: {
    label: 'Tokens',
    descricao: 'Tokens processados por dia, por fonte',
    axyoma: 'tokensAxyoma',
    byok: 'tokensByok',
  },
  creditos: {
    label: 'Créditos',
    descricao: 'Créditos consumidos por dia · o BYOK não debita crédito',
    axyoma: 'creditosAxyoma',
    byok: 'creditosByok',
  },
  chamadas: {
    label: 'Chamadas',
    descricao: 'Requisições por dia, por fonte',
    axyoma: 'chamadasAxyoma',
    byok: 'chamadasByok',
  },
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** 262.169.636 → "262,2 M". Token em número cheio não se lê num rodapé. */
function fmtCompacto(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} B`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} M`
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} k`
  return fmt(n)
}

/**
 * Cores das curvas.
 *
 * NÃO usa `--chart-1`/`--chart-2`: essa paleta é inteiramente cinza
 * (`oklch(0.87 0 0)` tem croma zero), e a curva do Axyoma ficava cinza-claro
 * sobre fundo branco — praticamente invisível. Com duas séries sobrepostas,
 * duas tonalidades do mesmo cinza também não se distinguem.
 *
 * Âmbar é a cor da marca (`--brand-1`); o azul é escolhido por ser o oposto
 * dela na roda, então as duas áreas se separam mesmo empilhadas — e continuam
 * distinguíveis nas formas mais comuns de daltonismo, o que dois tons de
 * laranja não garantiriam.
 */
const COR_AXYOMA = '#fb860a'
const COR_BYOK = '#2b7fff'

const chartConfig = {
  axyoma: { label: 'Créditos Axyoma', color: COR_AXYOMA },
  byok: { label: 'Sua chave (BYOK)', color: COR_BYOK },
} satisfies ChartConfig

function UsageTooltip({
  active,
  payload,
  metrica,
  creditBrl,
}: {
  active?: boolean
  payload?: { payload: PontoDiario }[]
  metrica: Metrica
  creditBrl: number
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const m = METRICAS[metrica]
  const vAxyoma = Number(p[m.axyoma] ?? 0)
  const vByok = Number(p[m.byok] ?? 0)

  return (
    <div className="border-border/50 bg-background grid min-w-44 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-medium">
        {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </span>

      <LinhaTooltip cor={COR_AXYOMA} rotulo="Axyoma" valor={fmt(vAxyoma)} />
      {metrica === 'creditos' && vAxyoma > 0 && (
        <span className="text-muted-foreground pl-3.5">≈ R$ {fmt(creditsToBRL(vAxyoma, creditBrl))}</span>
      )}

      <LinhaTooltip cor={COR_BYOK} rotulo="BYOK" valor={fmt(vByok)} />
      {/* Sem esta linha um zero no BYOK parece "não usei", quando significa
          "usei, e não custou crédito nenhum daqui". */}
      {metrica === 'creditos' && <span className="text-muted-foreground pl-3.5">pago pela sua chave</span>}
    </div>
  )
}

function LinhaTooltip({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: cor }} />
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="ml-auto font-medium tabular-nums">{valor}</span>
    </span>
  )
}

export function UsageChart({
  data,
  creditBrl = FALLBACK_CREDIT_BRL,
  titulo = 'Uso diário',
}: {
  data: PontoDiario[]
  creditBrl?: number
  titulo?: string
}): React.JSX.Element {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [metrica, setMetrica] = useState<Metrica>('tokens')

  const filtered = useMemo(() => data.slice(-RANGE_DAYS[range]), [data, range])
  const m = METRICAS[metrica]

  // Só desenha a curva do BYOK quando ela tem o que dizer. Numa conta que nunca
  // usou chave própria, uma reta no zero atravessando o gráfico é ruído.
  const temByok = useMemo(
    () => filtered.some((p) => Number(p.tokensByok) > 0 || Number(p.chamadasByok) > 0),
    [filtered],
  )

  const total = useMemo(
    () => filtered.reduce((a, p) => a + Number(p[m.axyoma] ?? 0) + Number(p[m.byok] ?? 0), 0),
    [filtered, m],
  )

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{m.descricao}</CardDescription>
        </div>
        <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
          <SelectTrigger className="w-[130px] rounded-lg" aria-label="Selecionar métrica">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {(Object.keys(METRICAS) as Metrica[]).map((k) => (
              <SelectItem key={k} value={k} className="rounded-lg">
                {METRICAS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as '7d' | '30d' | '90d')}>
          <SelectTrigger className="w-[140px] rounded-lg" aria-label="Selecionar período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">Últimos 90 dias</SelectItem>
            <SelectItem value="30d" className="rounded-lg">Últimos 30 dias</SelectItem>
            <SelectItem value="7d" className="rounded-lg">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="fillAxyoma" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-axyoma)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-axyoma)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillByok" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-byok)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-byok)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
              }
            />
            <ChartTooltip cursor={false} content={<UsageTooltip metrica={metrica} creditBrl={creditBrl} />} />
            {/* BYOK primeiro: costuma ser a menor das duas, e desenhada depois
                ficaria escondida sob a área do Axyoma. */}
            {temByok && <Area dataKey={m.byok} type="natural" fill="url(#fillByok)" stroke="var(--color-byok)" />}
            <Area dataKey={m.axyoma} type="natural" fill="url(#fillAxyoma)" stroke="var(--color-axyoma)" />
          </AreaChart>
        </ChartContainer>

        {temByok && (
          <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
            <Legenda cor={COR_AXYOMA} texto="Créditos Axyoma" />
            <Legenda cor={COR_BYOK} texto="Sua chave (BYOK)" />
            <span className="ml-auto tabular-nums">{fmtCompacto(total)} no período</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: cor }} />
      {texto}
    </span>
  )
}
