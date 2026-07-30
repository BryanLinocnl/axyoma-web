'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, Users, Layers, AlertTriangle } from 'lucide-react'
import { useConta } from '@/lib/conta-context'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminErrorGroup } from '@/lib/supabase-admin'

/**
 * Quadro de erros do agente.
 *
 * O card é o GRUPO, não a ocorrência: um defeito com 340 ocorrências vira um
 * card com "340×", e não 340 cards. Sem isso não há como atacar em escala, que
 * é justamente o que este quadro existe para permitir.
 */
type Status = 'novo' | 'investigando' | 'corrigido' | 'ignorado'

const COLUNAS: { id: Status; titulo: string; dica: string }[] = [
  { id: 'novo', titulo: 'Novo', dica: 'ainda não olhado' },
  { id: 'investigando', titulo: 'Investigando', dica: 'em análise' },
  { id: 'corrigido', titulo: 'Corrigido', dica: 'com a versão da correção' },
  { id: 'ignorado', titulo: 'Ignorado', dica: 'não vamos tratar' },
]

function quando(iso: string): string {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 60) return `${min}min`
  if (min < 1440) return `${Math.floor(min / 60)}h`
  return `${Math.floor(min / 1440)}d`
}

/**
 * A correção saiu numa versão ANTERIOR à última ocorrência?
 *
 * É o caso que separa "usuário desatualizado" de REGRESSÃO — e os dois pedem
 * ações opostas. Sem a versão no relatório, seriam indistinguíveis.
 */
function ehRegressao(g: AdminErrorGroup): boolean {
  if (g.status !== 'corrigido' || !g.fixed_in_version || !g.ultima_versao) return false
  return comparaVersao(g.ultima_versao, g.fixed_in_version) >= 0
}

/** SemVer numérico simples. Parte não numérica não participa da comparação. */
function comparaVersao(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export default function ErrosPage(): React.JSX.Element {
  const router = useRouter()
  const { loading, isAdmin, token } = useConta()
  const [grupos, setGrupos] = useState<AdminErrorGroup[]>([])
  const [bucket, setBucket] = useState<'bug' | 'ambiente' | 'todos'>('bug')
  const [porVariacao, setPorVariacao] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState<AdminErrorGroup | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    if (!token) return
    setCarregando(true)
    try {
      const q = new URLSearchParams({ bucket, dias: '30', variacao: porVariacao ? '1' : '0' })
      const r = await fetch(`/api/admin/errors?${q}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = (await r.json()) as { grupos?: AdminErrorGroup[]; error?: string }
      if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`)
      setGrupos(j.grupos ?? [])
      setErro('')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [token, bucket, porVariacao])

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.replace('/conta/visao-geral/visao-geral')
      return
    }
    void carregar()
  }, [loading, isAdmin, router, carregar])

  const mover = async (g: AdminErrorGroup, status: Status, versao?: string): Promise<void> => {
    // Otimista: o quadro responde na hora e reconcilia depois. Esperar a rede
    // para mover um card faz o arraste parecer travado.
    setGrupos((atual) => atual.map((x) => (x.chave === g.chave ? { ...x, status, fixed_in_version: versao ?? null } : x)))
    try {
      const r = await fetch('/api/admin/errors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: g.chave, status, fixed_in_version: versao ?? null }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } catch (e) {
      // Sem biblioteca de toast no site — e não vale instalar uma por causa de
      // um caso de erro. A mensagem vai para a mesma faixa que já mostra falha
      // de carregamento, e o quadro recarrega para desfazer o movimento
      // otimista que não chegou ao servidor.
      setErro(`Não consegui mover o card: ${(e as Error).message}`)
      void carregar()
    }
  }

  const porColuna = useMemo(() => {
    const m = new Map<Status, AdminErrorGroup[]>(COLUNAS.map((c) => [c.id, []]))
    for (const g of grupos) m.get(g.status)?.push(g)
    return m
  }, [grupos])

  if (loading) return <p className="text-muted-foreground text-sm">Carregando…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/conta/admin/dev" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" /> Painel
        </Link>
        <div className="flex-1" />

        {/* `bug` é o padrão: erro de ambiente (crédito, timeout, rate limit do
            provider do usuário) não é defeito nosso e não pode competir por
            atenção. Continua acessível porque o VOLUME dele é sinal. */}
        <Seletor
          valor={bucket}
          onChange={(v) => setBucket(v as typeof bucket)}
          opcoes={[
            { v: 'bug', l: 'Defeitos' },
            { v: 'ambiente', l: 'Ambiente' },
            { v: 'todos', l: 'Tudo' },
          ]}
        />
        <Seletor
          valor={porVariacao ? '1' : '0'}
          onChange={(v) => setPorVariacao(v === '1')}
          opcoes={[
            { v: '0', l: 'Agrupado' },
            { v: '1', l: 'Por variação' },
          ]}
        />
      </div>

      {erro && <p className="text-sm text-red-500">Erro ao carregar: {erro}</p>}

      {!erro && !carregando && grupos.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Nenhum erro no período</p>
          <p className="text-muted-foreground mt-1 text-xs">
            A coleta começa a preencher isto assim que a versão com o relatório de erro estiver na
            mão dos usuários.
          </p>
        </Card>
      )}

      {grupos.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const itens = porColuna.get(col.id) ?? []
            return (
              <div key={col.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between px-1">
                  <span className="text-sm font-semibold">{col.titulo}</span>
                  <span className="text-muted-foreground text-xs">
                    {itens.length > 0 ? itens.length : col.dica}
                  </span>
                </div>
                {itens.map((g) => (
                  <CardErro key={g.chave} g={g} onAbrir={() => setAberto(g)} onMover={mover} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {aberto && <Detalhe g={aberto} onFechar={() => setAberto(null)} />}
    </div>
  )
}

function Seletor({
  valor, onChange, opcoes,
}: {
  valor: string
  onChange: (v: string) => void
  opcoes: { v: string; l: string }[]
}): React.JSX.Element {
  return (
    <div className="border-border flex rounded-md border p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded px-2.5 py-1 text-xs transition',
            valor === o.v ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function CardErro({
  g, onAbrir, onMover,
}: {
  g: AdminErrorGroup
  onAbrir: () => void
  onMover: (g: AdminErrorGroup, s: Status, v?: string) => void
}): React.JSX.Element {
  const regressao = ehRegressao(g)
  return (
    <Card className={cn('p-3', regressao && 'border-red-500/50')}>
      <button onClick={onAbrir} className="w-full text-left">
        <p className="line-clamp-2 text-xs font-medium">{g.titulo}</p>
        {g.mensagem && <p className="text-muted-foreground mt-1 line-clamp-2 font-mono text-[11px]">{g.mensagem}</p>}
      </button>

      {/* REGRESSÃO: marcado como corrigido, mas voltou a acontecer numa versão
          igual ou posterior à da correção. É o oposto de "usuário
          desatualizado", e sem a versão no relatório os dois seriam a mesma
          coisa na tela. */}
      {regressao && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-red-500">
          <AlertTriangle className="size-3" />
          voltou na v{g.ultima_versao}, corrigido na v{g.fixed_in_version}
        </p>
      )}

      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span title="ocorrências">{g.ocorrencias}×</span>
        <span className="flex items-center gap-1" title="usuários distintos">
          <Users className="size-3" />
          {g.usuarios}
        </span>
        {g.variacoes > 1 && (
          <span className="flex items-center gap-1" title="variações da mensagem">
            <Layers className="size-3" />
            {g.variacoes}
          </span>
        )}
        {g.ultima_versao && <span className="font-mono">v{g.ultima_versao}</span>}
        <span className="ml-auto">{quando(g.ultima)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {COLUNAS.filter((c) => c.id !== g.status).map((c) => (
          <button
            key={c.id}
            onClick={() => {
              // A versão da correção é obrigatória no 'corrigido': sem ela não
              // dá para distinguir regressão de usuário desatualizado depois.
              if (c.id === 'corrigido') {
                const v = window.prompt('Corrigido em qual versão do app?', g.ultima_versao ?? '')
                if (!v) return
                onMover(g, c.id, v.trim())
                return
              }
              onMover(g, c.id)
            }}
            className="border-border hover:bg-accent rounded border px-1.5 py-0.5 text-[10px] transition"
          >
            {c.titulo}
          </button>
        ))}
      </div>
    </Card>
  )
}

function Detalhe({ g, onFechar }: { g: AdminErrorGroup; onFechar: () => void }): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)

  // Bloco pronto para colar num agente ou numa issue. É o "copiar em escala" que
  // este quadro se propõe a permitir: sem stack e contexto juntos, cada card
  // exigiria montar o relato à mão.
  const texto = [
    `# ${g.titulo}`,
    g.mensagem ? `\n${g.mensagem}` : '',
    `\nOcorrências: ${g.ocorrencias} · Usuários: ${g.usuarios} · Variações: ${g.variacoes}`,
    `Primeira: ${new Date(g.primeira).toLocaleString('pt-BR')} · Última: ${new Date(g.ultima).toLocaleString('pt-BR')}`,
    g.versoes?.length ? `Versões: ${g.versoes.join(', ')}` : '',
    [g.modo && `Modo: ${g.modo}`, g.provider && `Provider: ${g.provider}`, g.model_id && `Modelo: ${g.model_id}`]
      .filter(Boolean)
      .join(' · '),
    g.error_class ? `Classe: ${g.error_class}` : '',
    g.stack ? `\n\`\`\`\n${g.stack}\n\`\`\`` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onFechar}>
      <Card className="max-h-[85vh] w-full max-w-3xl overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{g.titulo}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {g.ocorrencias} ocorrências · {g.usuarios} usuário(s) · {g.variacoes} variação(ões)
              {g.versoes?.length ? ` · v${g.versoes.join(', v')}` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(texto)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1500)
            }}
            className="border-border hover:bg-accent flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
          >
            {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiado ? 'Copiado' : 'Copiar relatório'}
          </button>
        </div>

        {g.mensagem && (
          <pre className="bg-muted mb-3 overflow-x-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
            {g.mensagem}
          </pre>
        )}
        {g.stack && (
          <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
            {g.stack}
          </pre>
        )}
        {g.nota && <p className="text-muted-foreground mt-3 text-xs">Nota: {g.nota}</p>}
      </Card>
    </div>
  )
}
