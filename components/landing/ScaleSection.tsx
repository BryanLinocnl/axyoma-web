import { AppMock } from './AppMock'

const COLUMNS: [string, string][] = [
  [
    'Comece sem configurar nada',
    'Crie sua conta e faça sua primeira execução em poucos segundos. Nenhuma API é necessária para começar.',
  ],
  [
    'Transparência em cada execução',
    'Antes de confirmar qualquer tarefa, você sabe qual modelo será utilizado e quanto aquela execução irá consumir.',
  ],
  [
    'Liberdade para escolher',
    'Use os créditos do Axyoma ou conecte sua OpenRouter quando quiser. A plataforma funciona da forma que fizer mais sentido para você.',
  ],
]

export function ScaleSection(): React.JSX.Element {
  return (
    <section className="gb-desk-band relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 pb-0 pt-20 sm:px-6 sm:pt-28 lg:pt-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">Comece em segundos.</span>
          <span className="block">Trabalhe do seu jeito.</span>
        </h2>
        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          Crie sua conta e receba créditos para começar imediatamente. Se preferir, conecte sua
          própria API e continue usando sua infraestrutura desde o primeiro dia.
        </p>
      </div>

      {/* Mesma técnica do hero, espelhada: o painel entra pela esquerda e sai
          pela direita, para o olho não repetir o movimento do primeiro viewport. */}
      <div className="gb-stage relative mt-12 sm:mt-16">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <div className="ml-0 w-full sm:-ml-[10%] sm:w-[116%] lg:-ml-[8%] lg:w-[110%]">
            <div className="gb-tilt-right gb-fade-bottom">
              <AppMock mode="plan" />
            </div>
          </div>
        </div>
        <div className="h-20 sm:h-28" />
      </div>

      <div className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-6 sm:pb-28">
        <div
          className="grid gap-x-10 gap-y-8 pt-10 md:grid-cols-3"
          style={{ borderTop: '1px solid var(--hairline)' }}
        >
          {COLUMNS.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-[16px] font-semibold tracking-[-0.015em]">{title}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
