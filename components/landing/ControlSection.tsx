/**
 * Segunda batida da página: a declaração grande + três provas ilustradas.
 *
 * As ilustrações são pedaços REAIS da interface (o seletor de modo, a trilha de
 * execução, o pedido de permissão) em miniatura — não ícone dentro de quadrado
 * colorido. O `+` de cada cartão abre o texto: a afordância do template vira
 * controle de verdade, navegável por teclado.
 */

function ModeStack(): React.JSX.Element {
  const modes: [string, string][] = [
    ['Design', 'arte pra rede social'],
    ['Plan', 'tarefas revisáveis'],
    ['Code', 'agente no seu projeto'],
  ]
  return (
    <div className="flex flex-col gap-2 pt-2">
      {modes.map(([m, d], i) => (
        <div
          key={m}
          className="gb-glass-thick flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
          style={{
            border: '1px solid var(--hairline)',
            marginLeft: `${i * 14}px`,
            marginRight: `${(2 - i) * 14}px`,
          }}
        >
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: i === 2 ? 'var(--accent)' : 'var(--hairline-strong)' }}
          />
          <span className="text-[12.5px] font-medium">{m}</span>
          <span className="truncate text-[11px]" style={{ color: 'var(--ink-faint)' }}>
            {d}
          </span>
        </div>
      ))}
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
    title: 'Três modos, um app só',
    body: 'Design para as artes, Plan para quebrar a feature em tarefas, Code para o agente executar. A troca é uma aba — não é abrir outro programa.',
    art: ModeStack,
  },
  {
    title: 'Do arquivo ao PR, sem sair daqui',
    body: 'O agente lê o projeto, escreve o código, roda os comandos no terminal e abre o pull request no GitHub. Cada passo fica registrado na trilha.',
    art: RunTrail,
  },
  {
    title: 'Nada executa sem sua permissão',
    body: 'Comando de terminal, escrita fora do projeto e ação destrutiva param e pedem autorização. Você libera uma vez ou para o projeto inteiro.',
    art: PermissionPrompt,
  },
]

export function ControlSection(): React.JSX.Element {
  return (
    <section id="controle" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <h2 className="gb-display max-w-[15ch] text-[clamp(2.1rem,4.6vw,3.25rem)]">
            Feito pra quem vai rápido e não abre mão do controle.
          </h2>
          <p
            className="gb-measure text-[16.5px] leading-relaxed lg:pb-2"
            style={{ color: 'var(--ink-muted)' }}
          >
            O agente trabalha nos seus arquivos, no seu terminal, no seu repositório. Cada passo é
            visível, revisável e reversível — e o custo aparece em crédito na hora, não no fim do
            mês.
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
