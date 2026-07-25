/**
 * Os quadrantes do produto — quatro superfícies separadas por hairline, não por
 * caixa. Cada uma mostra a coisa em si: a árvore com o diff, as tarefas do
 * plano, as pranchetas do canvas, as ferramentas conectadas.
 */

function CodeArt(): React.JSX.Element {
  const files: [string, string | null][] = [
    ['src/lib/frete.ts', '+18 −6'],
    ['src/checkout/total.ts', '+4'],
    ['test/frete.spec.ts', '+31'],
    ['README.md', null],
  ]
  return (
    <div
      className="gb-raised overflow-hidden rounded-[12px]"
      style={{ border: '1px solid var(--hairline)' }}
    >
      {files.map(([f, d], i) => (
        <div
          key={f}
          className="flex items-center gap-2 px-3.5 py-2.5"
          style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
        >
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ background: d ? 'var(--accent)' : 'var(--hairline-strong)' }}
          />
          <span className="gb-mono flex-1 truncate text-[11.5px]">{f}</span>
          {d && (
            <span className="gb-mono text-[10.5px]" style={{ color: 'var(--accent)' }}>
              {d}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function PlanArt(): React.JSX.Element {
  const items: [string, boolean][] = [
    ['Mapear faixas de CEP por região', true],
    ['Trocar fallback por erro explícito', true],
    ['Cobrir Nordeste com teste', false],
    ['Atualizar snapshot do checkout', false],
  ]
  return (
    <div
      className="gb-raised rounded-[12px] p-3.5"
      style={{ border: '1px solid var(--hairline)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="gb-mono text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
          tasks.md
        </span>
        <span className="gb-mono text-[10.5px]" style={{ color: 'var(--accent)' }}>
          2/4
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map(([t, done]) => (
          <div key={t} className="flex items-center gap-2.5">
            <span
              className="grid h-[14px] w-[14px] shrink-0 place-items-center rounded-[4px] text-[8px] font-bold text-white"
              style={
                done ? { background: 'var(--accent)' } : { border: '1.5px solid var(--hairline-strong)' }
              }
            >
              {done ? '✓' : ''}
            </span>
            <span
              className="truncate text-[12px]"
              style={done ? { color: 'var(--ink-faint)' } : undefined}
            >
              {t}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DesignArt(): React.JSX.Element {
  // Peças escritas, não retângulo com degradê: a prancheta tem que parecer o
  // post que sai do canvas.
  const boards = [
    {
      label: 'Post',
      bg: 'linear-gradient(155deg,#1d4ed8,#2563eb 58%,#1e40af)',
      kicker: 'Só esta semana',
      title: 'Frete grátis\npro Nordeste',
    },
    {
      label: 'Story',
      bg: 'linear-gradient(155deg,#0f172a,#1e293b)',
      kicker: 'Novidade',
      title: 'Coleção\nde inverno',
    },
    {
      label: 'Capa',
      bg: 'linear-gradient(155deg,#f5820b,#ea580c)',
      kicker: 'Liquida',
      title: 'Até 50%\nde desconto',
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {boards.map((b, i) => (
        <div key={b.label} className="flex flex-col gap-1.5">
          <div
            className="relative flex flex-col justify-end overflow-hidden rounded-[10px] p-2.5"
            style={{
              background: b.bg,
              aspectRatio: '4 / 3.4',
              boxShadow: i === 0 ? '0 0 0 2px var(--accent)' : 'none',
            }}
          >
            <span className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {b.kicker}
            </span>
            <span className="gb-display mt-1 whitespace-pre-line text-[13px] leading-[1.02] text-white">
              {b.title}
            </span>
          </div>
          <span className="text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
            {b.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function ToolsArt(): React.JSX.Element {
  const tools = ['GitHub', 'Terminal', 'Arquivos', 'Supabase', 'Figma', 'Postgres']
  return (
    <div className="flex flex-col gap-3.5">
      <div
        className="gb-raised rounded-[12px] p-3.5"
        style={{ border: '1px solid var(--hairline)' }}
      >
        <div className="flex items-baseline justify-between">
          <span className="gb-mono text-[11px]">revisar-pr.md</span>
          <span className="text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
            skill
          </span>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Antes de abrir PR: rodar os testes, conferir o lint, escrever a descrição em português e
          marcar o time de review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tools.map((t, i) => (
          <span
            key={t}
            className="gb-raised rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{
              border: '1px solid var(--hairline)',
              color: i < 3 ? 'var(--accent)' : 'var(--ink-muted)',
            }}
          >
            {t}
          </span>
        ))}
        <span className="rounded-full px-3 py-1.5 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
          + qualquer servidor MCP
        </span>
      </div>
    </div>
  )
}

const QUADRANTS: { title: string; body: string; art: () => React.JSX.Element; tag?: string }[] = [
  {
    title: 'Modo Code',
    body: 'O agente lê o projeto, escreve e edita os arquivos, roda comandos no terminal, depura o que quebrou e abre o PR.',
    art: CodeArt,
  },
  {
    title: 'Modo Plan',
    body: 'A feature vira uma lista de tarefas em markdown que você lê, corrige e aprova. Só depois disso alguma coisa executa.',
    art: PlanArt,
  },
  {
    title: 'Modo Design',
    body: 'Posts, stories e carrosséis para as suas redes: a IA desenha no canvas, você ajusta camada por camada e exporta.',
    art: DesignArt,
    tag: 'Pro · em breve',
  },
  {
    title: 'Skills e MCP',
    body: 'Ensine um procedimento ao agente com uma skill e conecte as ferramentas que você já usa por servidores MCP.',
    art: ToolsArt,
  },
]

export function ProductGrid(): React.JSX.Element {
  return (
    <section id="modos" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div
          className="grid md:grid-cols-2"
          style={{ borderTop: '1px solid var(--hairline)' }}
        >
          {QUADRANTS.map(({ title, body, art: Art, tag }, i) => (
            <article
              key={title}
              className="flex flex-col gap-5 py-9 md:px-9 md:first:pl-0 md:[&:nth-child(3)]:pl-0"
              style={{
                borderBottom: '1px solid var(--hairline)',
                ...(i % 2 === 0 ? {} : { borderLeft: '1px solid var(--hairline)' }),
              }}
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h3>
                  {tag && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                      style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
                    >
                      {tag}
                    </span>
                  )}
                </div>
                <p
                  className="mt-2.5 max-w-[46ch] text-[14.5px] leading-relaxed"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {body}
                </p>
              </div>
              <div className="mt-auto">
                <Art />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
