/**
 * Segunda batida da página: a declaração grande + três provas ilustradas.
 *
 * As ilustrações são pedaços REAIS da interface (o seletor de modo, a trilha de
 * execução, o pedido de permissão) em miniatura — não ícone dentro de quadrado
 * colorido. O `+` de cada cartão abre o texto: a afordância do template vira
 * controle de verdade, navegável por teclado.
 */

function PlanProposal(): React.JSX.Element {
  const steps: [string, boolean][] = [
    ['Mapear as faixas de CEP por região', true],
    ['Trocar o fallback por erro explícito', true],
    ['Cobrir Nordeste e Norte com teste', false],
  ]
  return (
    <div className="pt-2">
      <div
        className="gb-raised rounded-[12px] p-3.5"
        style={{ border: '1px solid var(--hairline)' }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-medium">Plano proposto</span>
          <span className="gb-mono text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
            3 tarefas
          </span>
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {steps.map(([t, on]) => (
            <div key={t} className="flex items-start gap-2">
              <span
                className="mt-[3px] grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px] text-[8px] font-bold text-white"
                style={
                  on
                    ? { background: 'var(--accent)' }
                    : { border: '1.5px solid var(--hairline-strong)' }
                }
              >
                {on ? '✓' : ''}
              </span>
              <span className="text-[11.5px] leading-snug">{t}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <span
            className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            Aprovar
          </span>
          <span
            className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium"
            style={{ border: '1px solid var(--hairline)', color: 'var(--ink-muted)' }}
          >
            Editar plano
          </span>
        </div>
      </div>
    </div>
  )
}

function RunTrail(): React.JSX.Element {
  const steps: [string, string][] = [
    ['Leu', '3 arquivos'],
    ['Editou', 'frete.ts'],
    ['Rodou', 'npm test'],
    ['Abriu', 'PR #128'],
  ]
  return (
    <div className="flex flex-col gap-0 pt-2">
      {steps.map(([verb, obj], i) => (
        <div key={verb} className="flex items-center gap-3">
          <div className="flex flex-col items-center self-stretch">
            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{ background: 'var(--accent)', opacity: 0.35 + i * 0.22 }}
            />
            {i < steps.length - 1 && (
              <span className="w-px flex-1" style={{ background: 'var(--hairline-strong)' }} />
            )}
          </div>
          <div className="flex flex-1 items-baseline gap-2 pb-3">
            <span className="text-[12.5px] font-medium">{verb}</span>
            <span className="gb-mono text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              {obj}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function PermissionPrompt(): React.JSX.Element {
  return (
    <div className="pt-4">
      <div
        className="gb-raised rounded-[12px] p-3.5"
        style={{ border: '1px solid var(--hairline)' }}
      >
        <p className="text-[12.5px] font-medium">Rodar no terminal?</p>
        <p className="gb-mono mt-1.5 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
          npx prisma migrate deploy
        </p>
        <div className="mt-3 flex gap-2">
          <span
            className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            Permitir
          </span>
          <span
            className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium"
            style={{ border: '1px solid var(--hairline)', color: 'var(--ink-muted)' }}
          >
            Sempre neste projeto
          </span>
        </div>
      </div>
    </div>
  )
}

const CARDS: {
  title: string
  body: string
  art: () => React.JSX.Element
}[] = [
  {
    title: 'Planeje antes de executar',
    body: 'A IA cria um plano completo antes de começar. Revise, ajuste e aprove cada etapa.',
    art: PlanProposal,
  },
  {
    title: 'Tudo fica visível',
    body: 'Arquivos lidos, comandos executados, ferramentas utilizadas e custos aparecem em tempo real.',
    art: RunTrail,
  },
  {
    title: 'Controle total',
    body: 'Defina quando o agente pode agir sozinho e quando deve solicitar sua aprovação.',
    art: PermissionPrompt,
  },
]

export function ControlSection(): React.JSX.Element {
  return (
    <section id="controle" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <h2 className="gb-display max-w-[14ch] text-[clamp(2.1rem,4.6vw,3.25rem)]">
            A IA executa. Você continua no comando.
          </h2>
          <p
            className="gb-measure text-[16.5px] leading-relaxed lg:pb-2"
            style={{ color: 'var(--ink-muted)' }}
          >
            O Axyoma planeja, analisa arquivos, executa tarefas e acompanha o progresso. Antes de
            qualquer ação importante, você decide o que realmente acontece.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {CARDS.map(({ title, body, art: Art }) => (
            <details
              key={title}
              className="group flex flex-col overflow-hidden rounded-[24px] p-5"
              style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
            >
              <summary className="flex list-none flex-col gap-5 [&::-webkit-details-marker]:hidden">
                <div className="min-h-[152px]">
                  <Art />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="max-w-[18ch] text-[17px] font-semibold leading-snug tracking-[-0.015em]">
                    {title}
                  </h3>
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[17px] leading-none transition-transform duration-200 group-open:rotate-45"
                    style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-muted)' }}
                    aria-hidden
                  >
                    +
                  </span>
                </div>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {body}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
