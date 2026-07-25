import type { Icon } from '@tabler/icons-react'
import {
  IconBrandFigma,
  IconBrandGithub,
  IconBrandMeta,
  IconBrandNotion,
  IconBrandSlack,
  IconBrandStripe,
  IconBrandSupabase,
  IconBrandVercel,
} from '@tabler/icons-react'

/**
 * Os quadrantes do produto — quatro superfícies separadas por hairline, não por
 * caixa. Cada uma mostra a coisa em si: a árvore com o diff, as tarefas do
 * plano, os arquivos de skill, as marcas dos MCPs nativos.
 *
 * O modo Design saiu daqui a pedido do dono: ainda está cru demais para ser
 * vendido lado a lado com Code e Plan. Ele continua listado como recurso do
 * plano Pro em `Pricing.tsx`.
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

function SkillsArt(): React.JSX.Element {
  // Duas skills abertas + a contagem: mostra que skill é um arquivo de
  // procedimento em markdown, não um botão mágico.
  const skills: [string, string][] = [
    [
      'revisar-pr.md',
      'Antes de abrir PR: rodar os testes, conferir o lint, escrever a descrição em português e marcar o time de review.',
    ],
    [
      'migration-segura.md',
      'Nunca rodar migration sem backup. Gerar o SQL, mostrar o diff do schema e esperar aprovação.',
    ],
  ]
  return (
    <div className="flex flex-col gap-2.5">
      {skills.map(([file, body]) => (
        <div
          key={file}
          className="gb-raised rounded-[12px] p-3.5"
          style={{ border: '1px solid var(--hairline)' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="gb-mono text-[11px]">{file}</span>
            <span className="text-[10.5px]" style={{ color: 'var(--ink-faint)' }}>
              skill
            </span>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            {body}
          </p>
        </div>
      ))}
      <p className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
        Escreva as suas —{' '}
        <span className="font-medium" style={{ color: 'var(--accent)' }}>
          300 no plano Pro
        </span>
        .
      </p>
    </div>
  )
}

/* Marcas reais, do Tabler, para os presets nativos que ele cobre. Postgres,
 * Playwright, Brave Search, Higgsfield e Memória ficam em texto: desenhar um
 * logo de cor e forma aproximada é pior que não mostrar. */
const MCP_BRANDS: { name: string; Mark: Icon }[] = [
  { name: 'GitHub', Mark: IconBrandGithub },
  { name: 'Supabase', Mark: IconBrandSupabase },
  { name: 'Vercel', Mark: IconBrandVercel },
  { name: 'Slack', Mark: IconBrandSlack },
  { name: 'Notion', Mark: IconBrandNotion },
  { name: 'Figma', Mark: IconBrandFigma },
  { name: 'Stripe', Mark: IconBrandStripe },
  { name: 'Meta Ads', Mark: IconBrandMeta },
]

function McpArt(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3.5">
      <ul className="grid grid-cols-4 gap-2.5">
        {MCP_BRANDS.map(({ name, Mark }) => (
          <li
            key={name}
            className="gb-raised flex flex-col items-center justify-center gap-1.5 rounded-[12px] px-1 py-3"
            style={{ border: '1px solid var(--hairline)' }}
            title={name}
          >
            <Mark className="size-[19px]" stroke={1.6} aria-hidden />
            <span
              className="max-w-full truncate text-[10px] font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              {name}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        E também Postgres, Playwright, Brave Search, Higgsfield e Memória — mais qualquer servidor
        MCP que você apontar.
      </p>
    </div>
  )
}

const QUADRANTS: { title: string; body: string; art: () => React.JSX.Element; tag?: string }[] = [
  {
    title: 'Code',
    body: 'Leia projetos, implemente funcionalidades, execute testes e automatize tarefas de desenvolvimento com segurança.',
    art: CodeArt,
  },
  {
    title: 'Plan',
    body: 'Transforme objetivos em planos revisáveis antes da execução. Ajuste estratégias e aprove apenas o que fizer sentido.',
    art: PlanArt,
  },
  {
    title: 'Skills',
    body: 'Ensine um procedimento ao agente escrevendo um arquivo em markdown. Ele passa a seguir a sua regra, do seu jeito, em todo projeto.',
    art: SkillsArt,
  },
  {
    title: 'MCP',
    body: 'Conecte as ferramentas que você já usa. Os servidores mais comuns vêm prontos — é escolher e autenticar.',
    art: McpArt,
  },
]

export function ProductGrid(): React.JSX.Element {
  return (
    <section id="modos" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">Uma plataforma.</span>
          <span className="block">Aberta em todas as pontas.</span>
        </h2>
        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          Code e Plan para trabalhar. Skills para ensinar o seu jeito ao agente, MCP para conectar
          as ferramentas que você já usa.
        </p>

        <div
          className="mt-14 grid md:grid-cols-2"
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
