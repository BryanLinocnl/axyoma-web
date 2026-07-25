import { AxiomaLogo } from '@/components/AxiomaLogo'

/**
 * Shell do Axyoma recriado em HTML/CSS, no mundo macOS Glass (ver DESIGN.md).
 *
 * POR QUE MOCK E NÃO PRINT: não existe screenshot atual do app — o único no
 * repo (`public/code-mode.png`) é do design laranja anterior e ainda mostra o
 * nome e o e-mail reais do dono. Mock em HTML fica nítido em qualquer densidade
 * de tela, pesa uma fração de um PNG e não vaza dado de ninguém.
 *
 * TROCA POR PRINT REAL: o palco 3D (`.gb-stage` / `.gb-tilt`) mora em quem
 * chama, não aqui. Para usar um print, basta pôr um <Image> no lugar de
 * <AppMock/> dentro do mesmo palco — nenhum ajuste de layout é necessário.
 *
 * Todo o conteúdo é ilustrativo (projeto, conversa, diff, saldo).
 */

type Mode = 'code' | 'plan' | 'design'

const MODES: { id: Mode; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'plan', label: 'Plan' },
  { id: 'code', label: 'Code' },
]

function TrafficLights(): React.JSX.Element {
  return (
    <div className="flex items-center gap-[6px]" aria-hidden>
      <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
      <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
      <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
    </div>
  )
}

function ModeTabs({ active }: { active: Mode }): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-0.5 rounded-[9px] p-[3px]"
      style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
      aria-hidden
    >
      {MODES.map((m) => (
        <span
          key={m.id}
          className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium"
          style={
            m.id === active
              ? {
                  background: 'var(--raised)',
                  color: 'var(--ink)',
                  boxShadow: '0 1px 2px rgba(16,22,34,.14)',
                }
              : { color: 'var(--ink-faint)' }
          }
        >
          {m.label}
        </span>
      ))}
    </div>
  )
}

function Sidebar({ project, threads }: { project: string; threads: string[] }): React.JSX.Element {
  return (
    <aside
      className="gb-glass-thin hidden w-[188px] shrink-0 flex-col gap-4 p-3 sm:flex"
      style={{ borderRight: '1px solid var(--hairline)' }}
      aria-hidden
    >
      <div className="flex items-center gap-2 px-1 pt-1">
        <AxiomaLogo id="mock-side" className="h-[18px] w-[18px]" />
        <span className="gb-display text-[15px]" style={{ letterSpacing: '-0.02em' }}>
          Axyoma
        </span>
      </div>

      <div
        className="rounded-[9px] px-2.5 py-2"
        style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
      >
        <div className="text-[11px] font-medium leading-tight">{project}</div>
        <div className="gb-mono text-[9.5px] leading-tight" style={{ color: 'var(--ink-faint)' }}>
          ~/dev/{project}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="px-1 text-[9.5px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-faint)' }}
        >
          Conversas
        </div>
        {threads.map((t, i) => (
          <div
            key={t}
            className="truncate rounded-[7px] px-2 py-1.5 text-[11px]"
            style={
              i === 0
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--ink-muted)' }
            }
          >
            {t}
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 px-1">
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold"
          style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
        >
          BL
        </span>
        <div className="min-w-0">
          <div className="truncate text-[10.5px] font-medium leading-tight">Sua conta</div>
          <div className="gb-mono text-[9.5px] leading-tight" style={{ color: 'var(--accent)' }}>
            412 créditos
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ── Conteúdo por modo ──────────────────────────────────────────────────── */

function StepRow({
  label,
  detail,
  state = 'done',
}: {
  label: string
  detail: string
  state?: 'done' | 'running'
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-2.5">
      {state === 'done' ? (
        <span
          className="mt-[3px] grid h-[13px] w-[13px] shrink-0 place-items-center self-start rounded-full text-[8px] font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          ✓
        </span>
      ) : (
        <span
          className="gb-dot mt-[3px] h-[13px] w-[13px] shrink-0 self-start rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      )}
      <span className="text-[11.5px] font-medium">{label}</span>
      <span className="gb-mono truncate text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
        {detail}
      </span>
    </div>
  )
}

function CodeStage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex justify-end">
        <p
          className="max-w-[78%] rounded-[13px] rounded-br-[5px] px-3.5 py-2 text-[12px] leading-snug"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          O frete sai errado pra CEP do Nordeste. Acha a causa e corrige.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          A faixa 40000–65999 não estava mapeada e caía no fallback Sudeste. Corrigi a tabela e
          cobri com teste.
        </p>

        <div
          className="flex flex-col gap-2 rounded-[11px] p-3"
          style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
        >
          <StepRow label="Leu" detail="src/lib/frete.ts" />
          <StepRow label="Editou" detail="frete.ts · +18 −6" />
          <StepRow label="Terminal" detail="npm test — 24 passed" />
          <StepRow label="Abrindo PR" detail="fix/frete-nordeste" state="running" />
        </div>

        <div
          className="gb-mono overflow-hidden rounded-[11px] text-[10.5px] leading-[1.7]"
          style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-[10px]"
            style={{ borderBottom: '1px solid var(--hairline)', color: 'var(--ink-faint)' }}
          >
            src/lib/frete.ts
          </div>
          <div className="px-3 py-2">
            <div
              className="-mx-3 px-3"
              style={{ background: 'rgba(220,38,38,.08)', color: '#b42318' }}
            >
              <span className="opacity-50">− </span>const regiao = REGIOES[uf] ?? &apos;SE&apos;
            </div>
            <div
              className="-mx-3 px-3"
              style={{ background: 'rgba(21,128,61,.09)', color: '#15803d' }}
            >
              <span className="opacity-50">+ </span>const regiao = regiaoPorCep(cep)
            </div>
            <div style={{ color: 'var(--ink-faint)' }}>
              {'  '}if (!regiao) throw new FreteIndisponivel(cep)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanStage(): React.JSX.Element {
  // O caminho do arquivo fica COLADO na tarefa, não alinhado à direita da
  // coluna: em painel largo o alinhamento à direita abria 300px de vazio entre
  // a tarefa e o arquivo dela, e os dois deixavam de parecer o mesmo item.
  const tasks: [string, string, boolean][] = [
    ['Mapear as faixas de CEP por região', 'src/lib/frete.ts', true],
    ['Trocar o fallback por erro explícito', 'src/lib/frete.ts', true],
    ['Cobrir Nordeste e Norte com teste', 'test/frete.spec.ts', false],
    ['Atualizar o snapshot do checkout', 'test/checkout.spec.ts', false],
  ]
  return (
    <div className="flex max-w-[440px] flex-col gap-3.5 p-4 sm:p-5">
      <div>
        <h4 className="gb-display text-[19px]">Corrigir frete do Nordeste</h4>
        <p className="mt-1 text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
          4 tarefas · nada roda antes de você aprovar
        </p>
      </div>

      <div className="flex flex-col">
        {tasks.map(([t, file, done], i) => (
          <div
            key={t}
            className="flex items-baseline gap-2.5 py-2"
            style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
          >
            <span
              className="grid h-[15px] w-[15px] shrink-0 translate-y-[2px] place-items-center rounded-[4px] text-[9px] font-bold text-white"
              style={
                done
                  ? { background: 'var(--accent)' }
                  : { border: '1.5px solid var(--hairline-strong)' }
              }
            >
              {done ? '✓' : ''}
            </span>
            <span className="truncate text-[11.5px]">{t}</span>
            <span className="gb-mono shrink-0 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
              {file}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <span
          className="rounded-[8px] px-3 py-1.5 text-[11px] font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          Aprovar e executar
        </span>
        <span
          className="rounded-[8px] px-3 py-1.5 text-[11px] font-medium"
          style={{ border: '1px solid var(--hairline)', color: 'var(--ink-muted)' }}
        >
          Editar plano
        </span>
      </div>
    </div>
  )
}

function DesignStage(): React.JSX.Element {
  return (
    <div className="flex h-full gap-3 p-4 sm:p-5">
      <div className="flex flex-1 flex-col gap-2">
        <div
          className="relative flex-1 overflow-hidden rounded-[11px]"
          style={{
            background:
              'linear-gradient(155deg, #1d4ed8 0%, #3b82f6 46%, #f5820b 118%)',
            minHeight: 168,
          }}
        >
          <div className="absolute inset-0 flex flex-col justify-end gap-1.5 p-4 text-white">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.2em] opacity-80">
              Lançamento
            </span>
            <span className="gb-display text-[26px] leading-[0.95] text-white">
              Frete grátis
              <br />
              pro Nordeste
            </span>
          </div>
          {/* Alças de seleção do canvas */}
          <span
            className="absolute left-3 top-3 h-2 w-2 rounded-[2px] bg-white"
            style={{ boxShadow: '0 0 0 1.5px var(--accent)' }}
          />
          <span
            className="absolute right-3 top-3 h-2 w-2 rounded-[2px] bg-white"
            style={{ boxShadow: '0 0 0 1.5px var(--accent)' }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['1080×1350', 'Story', 'Carrossel'].map((c, i) => (
            <span
              key={c}
              className="rounded-[7px] px-2 py-1 text-[10px] font-medium"
              style={
                i === 0
                  ? { background: 'var(--accent-wash)', color: 'var(--accent)' }
                  : { color: 'var(--ink-faint)', border: '1px solid var(--hairline)' }
              }
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden w-[132px] shrink-0 flex-col gap-1 md:flex">
        <div
          className="px-1 pb-1 text-[9.5px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-faint)' }}
        >
          Camadas
        </div>
        {['Título', 'Selo de frete', 'Foto do produto', 'Fundo'].map((l, i) => (
          <div
            key={l}
            className="truncate rounded-[6px] px-2 py-1.5 text-[10.5px]"
            style={
              i === 0
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--ink-muted)' }
            }
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Shell ──────────────────────────────────────────────────────────────── */

const STAGE: Record<Mode, () => React.JSX.Element> = {
  code: CodeStage,
  plan: PlanStage,
  design: DesignStage,
}

const PROMPT: Record<Mode, string> = {
  code: 'Digite / para comandos',
  plan: 'Descreva a feature que quer planejar',
  design: 'Peça uma variação: “versão story, fundo mais escuro”',
}

const MODEL: Record<Mode, string> = {
  code: 'Claude Sonnet 4.5',
  plan: 'Gemini 3 Pro',
  design: 'GPT Image',
}

const STATS: Record<Mode, { tokens: string; extra: string; credits: string }> = {
  code: { tokens: '18,4k', extra: 'Modificações +18 −6', credits: '1,7 crédito' },
  plan: { tokens: '6,1k', extra: '4 tarefas', credits: '0,6 crédito' },
  design: { tokens: '2,3k', extra: '3 pranchetas', credits: '0,9 crédito' },
}

export function AppMock({
  mode = 'code',
  project = 'loja-verde',
  className = '',
}: {
  mode?: Mode
  project?: string
  className?: string
}): React.JSX.Element {
  const Stage = STAGE[mode]

  return (
    <div
      className={`gb-glass-thick overflow-hidden rounded-[14px] ${className}`}
      style={{ border: '1px solid var(--hairline)' }}
      role="img"
      aria-label={`Axyoma em modo ${mode === 'code' ? 'Code' : mode === 'plan' ? 'Plan' : 'Design'} — ilustração da interface do app`}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <TrafficLights />
        <div className="flex flex-1 justify-center">
          <ModeTabs active={mode} />
        </div>
        <div className="flex items-center gap-2.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[13px] w-[13px] rounded-[3px]"
              style={{ background: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-[268px]">
        <Sidebar
          project={project}
          threads={['Corrigir frete do Nordeste', 'Migrar checkout pro Pix', 'Rever webhook']}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Coluna de leitura com teto — igual ao app. Sem isso, nos painéis
              largos da landing o conteúdo esticava por 1000px e a conversa
              ficava com o texto de um lado e os metadados no outro extremo. */}
          <div className="mx-auto w-full max-w-[680px] flex-1">
            <Stage />
          </div>

          {/* Composer */}
          <div style={{ borderTop: '1px solid var(--hairline)' }}>
            <div className="mx-auto w-full max-w-[680px] px-4 pb-3.5 sm:px-5">
              <div
                className="flex items-center gap-3 py-2 text-[10px]"
                style={{ color: 'var(--ink-faint)' }}
              >
                <span className="gb-mono">Tokens {STATS[mode].tokens}</span>
                <span className="gb-mono">{STATS[mode].extra}</span>
                <span
                  className="gb-mono rounded-full px-2 py-0.5"
                  style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
                >
                  {STATS[mode].credits}
                </span>
              </div>
              <div
                className="flex items-center gap-2 rounded-[11px] px-3 py-2.5"
                style={{ background: 'var(--raised)', border: '1px solid var(--hairline)' }}
              >
                <span
                  className="flex-1 truncate text-[11.5px]"
                  style={{ color: 'var(--ink-faint)' }}
                >
                  {PROMPT[mode]}
                </span>
                <span
                  className="gb-caret inline-block h-[13px] w-[1.5px]"
                  style={{ background: 'var(--accent)' }}
                  aria-hidden
                />
                <span
                  className="gb-mono rounded-[7px] px-2 py-1 text-[10px]"
                  style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                >
                  {MODEL[mode]}
                </span>
                <span
                  className="grid h-[22px] w-[22px] place-items-center rounded-[7px] text-[11px] text-white"
                  style={{ background: 'var(--accent)' }}
                  aria-hidden
                >
                  ↑
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
