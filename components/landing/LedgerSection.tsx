import { RunTimeline } from './RunTimeline'

/**
 * A passagem densa da página, depois de dois viewports arejados: a trilha de
 * execução do agente — reta na tela, sem inclinação e sem máscara de dissolver
 * (os painéis inclinados são objetos saindo de cena; este é um documento que
 * precisa ser lido até a última linha) — do lado dos fatos que ela prova.
 */

const POINTS: [string, string][] = [
  [
    'Trilha de execução',
    'Cada arquivo lido, cada comando rodado, cada edição — em ordem, com o resultado do lado.',
  ],
  [
    'Custo por chamada',
    'O débito aparece na hora, ligado ao modelo que rodou. Nada de fatura surpresa no fim do mês.',
  ],
  [
    'Saldo que é seu',
    'Crédito comprado não vira pó no fim do mês. Você recarrega quando quiser, por PIX ou cartão.',
  ],
]

export function LedgerSection(): React.JSX.Element {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">Você acompanha cada ação.</span>
          <span className="block">E cada crédito.</span>
        </h2>
        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          Cada execução mostra quais modelos foram utilizados, quanto custou e quais ferramentas
          foram acionadas. Sem estimativas escondidas. Sem cobranças inesperadas.
        </p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <RunTimeline />

          <dl className="flex flex-col">
            {POINTS.map(([title, body], i) => (
              <div
                key={title}
                className="py-6 first:pt-0"
                style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
              >
                <dt className="text-[16.5px] font-semibold tracking-[-0.015em]">{title}</dt>
                <dd
                  className="mt-2 max-w-[54ch] text-[14.5px] leading-relaxed"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
