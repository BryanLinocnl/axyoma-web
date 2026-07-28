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
}

/*
 * O Pro NÃO é vendido como pacote de token.
 *
 * Com chave própria (BYOK) o usuário roda qualquer modelo pagando direto ao
 * provedor — ou seja, quem quer só token não precisa de assinatura nenhuma. Se
 * a assinatura vendesse token, o funil seria "traz a chave e nunca paga". O
 * que o Pro vende é o que a chave dele não compra: o que o agente já sabe
 * (skills), o que ele lembra (memória de projeto), o que ele repete (workflows)
 * e o que roda sem ninguém olhando (automações, nuvem). A franquia de créditos
 * fica onde é: no fim da lista, como conveniência.
 *
 * Tudo que ainda não está no ar vive sob o selo "Em breve", que é o que torna a
 * lista honesta — plano futuro, recursos futuros, e nenhum botão que cobre por
 * eles.
 */
const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    live: true,
    price: 'R$ 0',
    period: 'para sempre',
    desc: 'Comece sem cartão. 100 créditos de bônus, mais chave própria e modelos locais que não consomem crédito.',
    perks: [
      '100 créditos de bônus (modelos Vertex AI)',
      'Modo Code e modo Plan completos',
      'Modelos locais pelo Ollama, sem gastar crédito',
      'Ou conecte a sua chave da OpenRouter ou da OpenAI',
      'MCP, skills, busca na web e terminal',
      'Compre créditos quando quiser, sem assinar',
    ],
    cta: { href: '/download', label: 'Baixar grátis' },
  },
  {
    id: 'pro',
    name: 'Pro',
    live: false,
    desc: 'O agente que lembra do projeto, repete o que já deu certo e trabalha enquanto você faz outra coisa.',
    perks: [
      'Tudo do plano Free',
      '300 skills prontas para instalar',
      'Workflows salvos e reutilizáveis',
      'Memória de projeto entre sessões',
      'Automações agendadas e execução em nuvem',
      'Modo Design',
      'Franquia mensal de créditos (Vertex AI)',
    ],
  },
  {
    id: 'teams',
    name: 'Teams',
    live: false,
    desc: 'O mesmo agente para o time inteiro, com as regras, o histórico e a conta compartilhados.',
    perks: [
      'Tudo do plano Pro',
      'As mesmas skills do Pro, mais as de dinâmica de time',
      'Workflows e memória compartilhados',
      'Créditos compartilhados pelo time',
      'Assessoria Advisor',
    ],
  },
]

export function Pricing(): React.JSX.Element {
  return (
    <section id="planos" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Coluna do argumento */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="gb-display max-w-[14ch] text-[clamp(2.1rem,4.9vw,3.5rem)]">
              Escolha como prefere usar o Axyoma.
            </h2>
            <p
              className="gb-measure mt-6 text-[16.5px] leading-relaxed"
              style={{ color: 'var(--ink-muted)' }}
            >
              Comece grátis, com créditos inclusos e sem cartão. Se preferir pagar o provedor
              direto, conecte a sua própria chave — ou rode modelos locais, que não custam nada.
              A assinatura não é sobre token: é sobre o que o agente aprende, lembra e repete.
            </p>

            <dl className="mt-8 flex flex-col">
              {[
                // O preço do crédito saiu do parágrafo de abertura na revisão de
                // copy; fica aqui para não sumir da página — é o número que o
                // visitante procura antes de baixar.
                ['1 crédito', 'R$ 0,30, debitado pelo custo real do modelo'],
                ['Pagamento', 'PIX ou cartão, no site ou dentro do app'],
                ['Bônus de cadastro', '100 créditos, sem cartão'],
                ['Bônus e franquia', 'valem para os modelos da Vertex AI'],
                ['Créditos comprados', 'valem para todos os modelos'],
                // As duas saídas sem crédito. Ficam aqui, e não em destaque no
                // topo: "comece agora" continua sendo o caminho principal —
                // quem chega na página não quer escolher provedor, quer baixar.
                ['Chave própria', 'OpenRouter ou OpenAI: você paga o provedor, sem crédito Axyoma'],
                ['Modelos locais', 'pelo Ollama, na sua máquina, sem custo'],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                  style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
                >
                  <dt className="text-[14px] font-medium">{k}</dt>
                  <dd className="text-[14px]" style={{ color: 'var(--ink-muted)' }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Coluna dos planos */}
          <div className="flex flex-col gap-4">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={plan.live ? 'gb-raised rounded-[24px] p-6 sm:p-7' : 'rounded-[24px] p-6 sm:p-7'}
                style={
                  plan.live
                    ? { border: '1px solid var(--accent)' }
                    : {
                        border: '1px solid var(--hairline)',
                        background: 'color-mix(in srgb, var(--ink) 3%, transparent)',
                      }
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{plan.name}</h3>
                      {!plan.live && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                          style={{
                            border: '1px solid var(--hairline-strong)',
                            color: 'var(--ink-faint)',
                          }}
                        >
                          Em breve
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-2 max-w-[42ch] text-[14px] leading-relaxed"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {plan.desc}
                    </p>
                  </div>

                  {plan.live ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="gb-display text-[40px]">{plan.price}</span>
                      <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                        {plan.period}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>
                      Preço no lançamento
                    </span>
                  )}
                </div>

                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5 text-[14px]">
                      <span
                        className="mt-[3px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                        style={{ background: plan.live ? 'var(--accent)' : 'var(--hairline-strong)' }}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span style={{ color: 'var(--ink-muted)' }}>{perk}</span>
                    </li>
                  ))}
                </ul>

                {plan.cta && (
                  <Link
                    href={plan.cta.href}
                    className="gb-btn gb-btn-primary mt-7 w-full px-5 py-3 text-[15px]"
                  >
                    {plan.cta.label}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
