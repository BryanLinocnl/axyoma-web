const PILLARS = [
  {
    n: '01',
    title: 'Sem limite artificial de uso',
    body: 'Esqueça cota diária e “você atingiu o limite do plano”. No Axyoma o teto é o crédito que você decide usar — free pack + pacotes sob demanda.',
  },
  {
    n: '02',
    title: 'Sem chave de API',
    body: 'Conta + créditos e pronto. Zero OpenRouter, zero painel de provedor, zero montar stack só para começar a criar.',
  },
  {
    n: '03',
    title: 'Só paga o que usa',
    body: 'Free com 100 créditos de bônus. Pacotes quando quiser mais. Assinatura opcional — quando Pro e Teams abrirem.',
  },
  {
    n: '04',
    title: 'Agente que executa',
    body: 'Arquivos, terminal, GitHub e PR — com Plan antes. Você aprova, o agente entrega.',
  },
]

export function ValuePillars(): React.JSX.Element {
  return (
    <section id="porque" className="relative border-t border-white/8">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Por que Axyoma
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ofício sem travas opacas
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <article
              key={p.n}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] font-brand text-lg text-[var(--brand-1)]">
                  {p.n}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{p.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
