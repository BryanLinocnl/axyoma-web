import { Check, ChevronRight, FilePlus2, FileText, Pencil, TerminalSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * A trilha de execução do app, recriada em HTML.
 *
 * POR QUE NÃO PRINT: esta seção é a passagem densa da página e a trilha é o
 * elemento que ela promete no primeiro item da lista ao lado. Em HTML ela fica
 * nítida em qualquer densidade de tela, encolhe de verdade no celular (um print
 * de 2600px vira mancha) e pesa alguns kB em vez de centenas.
 *
 * O modelo é o `MessageTimeline` do app: trilho vertical, marcador de anel por
 * ação, ferramenta + alvo em mono, texto do agente intercalado e o marco de
 * etapa concluída em verde. O rodapé é o mesmo do turno real (tempo, tokens,
 * crédito) — é ele que prova o segundo item da lista, o custo por chamada.
 *
 * Conteúdo ilustrativo; a mecânica é a real.
 */

type Row =
  | { kind: 'read' | 'create' | 'edit' | 'shell'; label: string; target: string }
  | { kind: 'say'; text: React.ReactNode }
  | { kind: 'done'; label: string; target: string }

// Só o RÓTULO da ação é traduzido. `target` é caminho de arquivo e comando de
// shell: traduzir isso mostraria uma execução que não existe em máquina nenhuma.
// O `$` do shell também fica cru — é o prompt do terminal, não uma palavra.
function useRows(): Row[] {
  const t = useTranslations('timeline')
  return [
    { kind: 'read', label: t('reading'), target: 'components/screens/projection.tsx' },
    {
      kind: 'say',
      text: t.rich('say', { code: (chunks) => <Code>{chunks}</Code> }),
    },
    { kind: 'create', label: t('creating'), target: 'app/actions/ai-projection.ts' },
    { kind: 'edit', label: t('readingArtifact'), target: 'spec-etapa-3-ui.md' },
    { kind: 'shell', label: '$', target: 'bun run typecheck' },
    { kind: 'shell', label: '$', target: 'npm run lint' },
    { kind: 'done', label: t('doneStep'), target: 'app/actions/ai-projection.ts' },
    { kind: 'edit', label: t('savingArtifact'), target: 'tasks.md' },
    { kind: 'edit', label: t('savingArtifact'), target: 'progress.md' },
  ]
}

function Code({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <code
      className="gb-mono rounded-[5px] px-1 py-0.5 text-[0.88em]"
      style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
    >
      {children}
    </code>
  )
}

const ICONS = {
  read: FileText,
  create: FilePlus2,
  edit: Pencil,
  shell: TerminalSquare,
} as const

/** Marcador de anel do trilho: círculo vazado com aro no acento. */
function Node(): React.JSX.Element {
  return (
    <span
      className="relative z-10 block h-[9px] w-[9px] shrink-0 rounded-full"
      style={{ background: 'var(--raised)', boxShadow: '0 0 0 2px var(--accent)' }}
      aria-hidden
    />
  )
}

export function RunTimeline(): React.JSX.Element {
  const t = useTranslations('timeline')
  const ROWS = useRows()

  return (
    <div
      className="gb-raised self-start overflow-hidden rounded-[16px]"
      style={{ border: '1px solid var(--hairline)' }}
    >
      <ol className="relative flex flex-col px-5 py-5 sm:px-6">
        {/* Trilho contínuo por trás dos marcadores. Termina antes do último
            item para não pingar no vazio abaixo dele. */}
        <span
          aria-hidden
          className="absolute bottom-8 left-[calc(1.25rem+4px)] top-6 w-px sm:left-[calc(1.5rem+4px)]"
          style={{ background: 'var(--hairline-strong)' }}
        />

        {ROWS.map((row, i) => {
          if (row.kind === 'say') {
            return (
              <li key={i} className="flex gap-3.5 py-2.5">
                <span className="w-[9px] shrink-0" aria-hidden />
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {row.text}
                </p>
              </li>
            )
          }

          if (row.kind === 'done') {
            // MESMA grade das linhas normais (marcador 9px + ícone 15px +
            // texto): o marco antes usava um círculo maior deslocado com
            // translate, e o texto dele saía fora do prumo dos outros.
            return (
              <li key={i} className="flex items-center gap-3.5 py-2.5">
                <span
                  className="relative z-10 block h-[9px] w-[9px] shrink-0 rounded-full"
                  style={{ background: '#15803d', boxShadow: '0 0 0 3px #dcfce7' }}
                  aria-hidden
                />
                <Check
                  className="size-[15px] shrink-0"
                  style={{ color: '#15803d' }}
                  strokeWidth={2.4}
                  aria-hidden
                />
                <span
                  className="min-w-0 text-[13px] font-semibold leading-snug"
                  style={{ color: '#15803d' }}
                >
                  {row.label}{' '}
                  <span className="gb-mono font-normal text-[0.94em]">{row.target}</span>
                </span>
              </li>
            )
          }

          const Icon = ICONS[row.kind]
          return (
            <li key={i} className="flex items-center gap-3.5 py-[7px]">
              <Node />
              <Icon
                className="size-[15px] shrink-0"
                style={{ color: 'var(--ink-faint)' }}
                strokeWidth={1.6}
                aria-hidden
              />
              <span className="min-w-0 truncate text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                {row.kind === 'shell' ? (
                  <span className="gb-mono">
                    {row.label} {row.target}
                  </span>
                ) : (
                  <>
                    {row.label} <span className="gb-mono text-[0.94em]">{row.target}</span>
                  </>
                )}
              </span>
              <ChevronRight
                className="size-[13px] shrink-0"
                style={{ color: 'var(--ink-faint)' }}
                strokeWidth={1.6}
                aria-hidden
              />
            </li>
          )
        })}
      </ol>

      {/* Rodapé do turno — o custo, que é o segundo ponto da lista ao lado. */}
      {/* O chip de crédito fica num grupo próprio: com tudo na mesma linha
          flexível ele era o primeiro a quebrar e caía sozinho embaixo. */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        <div
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
          style={{ color: 'var(--ink-faint)' }}
        >
          <span className="gb-mono text-[12px]">{t('time')} 4:39</span>
          <span className="gb-mono text-[12px]">{t('tokens')} 730K</span>
          <span className="gb-mono text-[12px]">
            <span style={{ color: '#15803d' }}>+124</span>{' '}
            <span style={{ color: '#b42318' }}>−38</span>
          </span>
        </div>
        <span
          className="gb-mono shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
        >
          {t('credits')}
        </span>
      </div>
    </div>
  )
}
