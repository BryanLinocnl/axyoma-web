import Link from 'next/link'

type Plan = {
  id: string
  name: string
  live: boolean
  price?: string
  period?: string
  desc: string
  perks: string[]
  cta?: { href: string; label: string }
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    live: true,
    price: '0',
    period: 'para sempre',
    desc: 'Comece sem cartão: 400 créditos de bônus, como um mês de Pro para testar.',
    highlight: true,
    perks: [
      '400 créditos de bônus (modelos Vertex AI)',
      'Code Mode e Plan Mode',
      'Todas as ferramentas do app',
      'Demais modelos com créditos comprados',
      'Compre créditos quando quiser',
    ],
    cta: { href: '/download', label: 'Baixar grátis' },
  },
  {
    id: 'pro',
    name: 'Pro',
    live: false,
    desc: 'Tudo do Free, com Modo Design e créditos mensais.',
    perks: [
      'Tudo do Plano Free',
      'Skills personalizadas',
      'Créditos de franquia mensais (Vertex AI)',
      'Modo Design',
    ],
  },
  {
    id: 'teams',
    name: 'Teams',
    live: false,
    desc: 'Para times que criam juntos.',
    perks: [
      'Tudo do Plano Pro',
      'Ferramentas Teams Exclusivas',
      'Assessoria Advisor',
      'Créditos compartilhados pelo time (Vertex AI)',
    ],
  },
]

export function Pricing(): React.JSX.Element {
  return (
    <section id="planos" className="relative border-t border-white/8">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Planos
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Free agora. Pro e Teams em breve.
          </h2>
          <p className="mt-4 text-sm text-[var(--ink-dim)]">
            1 crédito = R$ 0,30 · pague com PIX · compre créditos quando quiser
          </p>
          <p className="mx-auto mt-2 max-w-xl text-xs text-[var(--ink-faint)]">
            Créditos de bônus e de franquia valem para os modelos da Vertex AI (Google Cloud).
            Créditos comprados valem para todos os modelos, incluindo os da Vertex.
          </p>
        </div>

        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                plan.highlight
                  ? 'border-[var(--brand-2)]/45 bg-white/[0.04] shadow-lg shadow-orange-900/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.035]'
              }`}
            >
              {plan.live ? (
                plan.highlight && (
                  <span className="brand-gradient absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-semibold text-black">
                    Disponível
                  </span>
                )
              ) : (
                <span className="absolute -top-3 left-6 rounded-full border border-white/15 bg-[#0a0a0c] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-dim)]">
                  Em breve
                </span>
              )}

              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold ${
                    plan.highlight
                      ? 'border-[var(--brand-2)]/30 bg-[var(--brand-2)]/10 text-[var(--brand-1)]'
                      : 'border-white/10 bg-white/[0.03] text-white'
                  }`}
                >
                  {plan.name[0]}
                </span>
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              </div>

              <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-[var(--ink-faint)]">
                {plan.desc}
              </p>

              {plan.live && plan.price !== undefined ? (
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-sm text-[var(--ink-dim)]">R$</span>
                  <span className="text-4xl font-semibold tracking-tight text-white">{plan.price}</span>
                  <span className="text-sm text-[var(--ink-dim)]">{plan.period}</span>
                </div>
              ) : (
                <div className="mt-4">
                  <span className="text-2xl font-semibold tracking-tight text-[var(--ink-dim)]">
                    Em breve
                  </span>
                </div>
              )}

              <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-white/8 pt-5 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[var(--ink-dim)]">
                    <span className="mt-0.5 font-semibold text-[var(--brand-1)]" aria-hidden>
                      ✓
                    </span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {plan.cta ? (
                <Link
                  href={plan.cta.href}
                  className="brand-gradient mt-7 block rounded-full py-2.5 text-center text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
                >
                  {plan.cta.label}
                </Link>
              ) : (
                <div
                  className="mt-7 block rounded-full border border-white/10 py-2.5 text-center text-sm font-medium text-[var(--ink-faint)]"
                  aria-disabled="true"
                >
                  Em breve
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
