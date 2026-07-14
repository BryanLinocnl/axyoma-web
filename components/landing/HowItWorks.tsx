const STEPS = [
  {
    n: '01',
    title: 'Baixe o app',
    body: 'Grátis para macOS, Windows e Linux.',
  },
  {
    n: '02',
    title: 'Crie sua conta',
    body: '100 créditos de bônus na hora. Sem cartão.',
  },
  {
    n: '03',
    title: 'Escolha o modelo',
    body: 'Claude, GPT, Gemini, DeepSeek e mais — no mesmo seletor.',
  },
  {
    n: '04',
    title: 'Crie sem travar',
    body: 'Design, Plan e Code. Continua com pacotes se quiser — sem teto opaco.',
  },
]

export function HowItWorks(): React.JSX.Element {
  return (
    <section id="como" className="relative border-t border-white/8 bg-[#030304]">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Como funciona
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Quatro passos. Ofício no fluxo.
          </h2>
        </div>

        <div className="relative mt-14">
          {/* Desktop connecting line */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block"
          />

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, idx) => (
              <article
                key={s.n}
                className="relative flex flex-row gap-4 sm:flex-col sm:items-center sm:text-center"
              >
                <div className="flex shrink-0 flex-col items-center">
                  <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0a0a0c] font-brand text-2xl text-[var(--brand-1)] shadow-lg shadow-black/40">
                    {s.n}
                  </span>
                  {idx !== STEPS.length - 1 && (
                    <div
                      aria-hidden
                      className="my-2 h-full w-px bg-gradient-to-b from-white/15 to-transparent sm:hidden"
                    />
                  )}
                </div>
                <div className="sm:pt-4">
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-dim)]">{s.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
