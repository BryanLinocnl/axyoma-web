/**
 * A passagem densa da página, depois de dois viewports arejados: um extrato de
 * uso de verdade, reto na tela (sem inclinação), do lado dos fatos que ele
 * prova. Números ilustrativos — a mecânica é a real: cada chamada debita pelo
 * custo do modelo, 1 crédito = R$ 0,30.
 */

const ROWS: [string, string, string][] = [
  ['14:02', 'Claude Sonnet 4.5', '1,74'],
  ['13:47', 'Gemini 3 Flash', '0,06'],
  ['11:20', 'GPT-5.2', '2,31'],
  ['10:58', 'Kimi K2', '0,42'],
  ['09:31', 'Gemini 3 Pro', '0,88'],
]

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
    'Checkpoint e desfazer',
    'O estado do projeto é salvo antes das mudanças. Não gostou do que o agente fez? Volta.',
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
          O Axyoma registra todas as operações realizadas pelo agente, mostra quais modelos foram
          utilizados e exibe o custo de cada etapa antes e depois da execução.
        </p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div
            className="gb-raised self-start overflow-hidden rounded-[16px]"
            style={{ border: '1px solid var(--hairline)' }}
          >
            <div
              className="flex items-baseline justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--hairline)' }}
            >
              <span className="text-[14px] font-semibold">Uso de hoje</span>
              <span className="gb-mono text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                5 chamadas
              </span>
            </div>

            <ul>
              {ROWS.map(([hora, modelo, custo], i) => (
                <li
                  key={hora}
                  className="flex items-center gap-3 px-5 py-3"
                  style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
                >
                  <span className="gb-mono text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                    {hora}
                  </span>
                  <span className="flex-1 truncate text-[13px]">{modelo}</span>
                  <span className="gb-mono text-[12.5px]">{custo}</span>
                </li>
              ))}
            </ul>

            <div
              className="flex items-baseline justify-between px-5 py-4"
              style={{ borderTop: '1px solid var(--hairline)', background: 'var(--accent-wash)' }}
            >
              <span className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
                Total do dia
              </span>
              <span className="gb-mono text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
                5,41 créditos
              </span>
            </div>
          </div>

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
