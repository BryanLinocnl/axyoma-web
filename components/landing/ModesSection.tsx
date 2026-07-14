import Image from 'next/image'

const MODES = [
  {
    id: 'design',
    name: 'Design',
    tagline: 'A IA desenha. Você publica.',
    body: 'Posts, carrosséis, motions e templates para as suas redes — a IA desenha, você ajusta e publica. Tudo no mesmo app.',
    badge: 'Pro · em breve',
  },
  {
    id: 'plan',
    name: 'Plan',
    tagline: 'Nada roda sem a sua aprovação.',
    body: 'Quebre a feature em tarefas, revise o plano e só então mande a IA executar. Controle em cada passo.',
  },
  {
    id: 'code',
    name: 'Code',
    tagline: 'Do arquivo ao PR — o agente faz.',
    body: 'Lê, escreve e edita o projeto, roda comandos, depura e entrega — do zero ao PR, sem sair do app.',
  },
]

export function ModesSection(): React.JSX.Element {
  return (
    <section id="modos" className="relative border-t border-white/8 bg-[#030304]">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Três modos
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Um estúdio. Três maneiras de criar.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink-dim)] sm:text-base">
            Design, Plan e Code no mesmo app — sem trocar ferramenta no meio do ofício.
          </p>
        </div>

        <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1.25fr_1fr]">
          {/* Mock */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-60"
              style={{
                background:
                  'radial-gradient(60% 50% at 50% 50%, rgba(251,134,10,0.10), transparent 70%)',
              }}
            />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
              <Image
                src="/code-mode.jpg"
                alt="Axyoma em modo Code — estúdio com chat de engenharia ao lado"
                width={1440}
                height={900}
                className="h-auto w-full"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 55vw, 720px"
              />
            </div>
          </div>

          {/* Mode cards — stacked with clear visual rhythm */}
          <div className="flex flex-col gap-4">
            {MODES.map((m, idx) => (
              <article
                key={m.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04] sm:p-6"
              >
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 transition-colors group-hover:bg-[var(--brand-2)]/60"
                  style={{
                    background:
                      idx === 0
                        ? 'linear-gradient(180deg, var(--brand-1), var(--brand-3))'
                        : 'rgba(255,255,255,0.06)',
                  }}
                />
                <div className="pl-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-sm font-semibold text-[var(--brand-1)]">
                        {idx + 1}
                      </span>
                      <span className="font-brand text-base text-[var(--brand-1)]">{m.name}</span>
                    </div>
                    {m.badge && (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-snug text-white">
                    {m.tagline}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-dim)]">{m.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
