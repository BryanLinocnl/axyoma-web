// Ver o comentário em SiteNav.tsx: href cru derruba o visitante para o pt-BR.
import { Link } from '@/i18n/navigation'

import { useTranslations } from 'next-intl'

type Plan = {
  id: 'free' | 'pro' | 'teams'
  /** Nome comercial — NÃO traduzido: Free/Pro/Teams são os nomes dos planos. */
  name: string
  live: boolean
  perks: number
  cta?: { href: string }
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
// `perks` é a QUANTIDADE de itens, não o texto: as frases vivem em
// `pricing.<plano>Perk<n>`. Somar um benefício é somar a chave nos DOIS
// catálogos e subir este número — sem isso o item novo não aparece.
const PLANS: Plan[] = [
  { id: 'free', name: 'Free', live: true, perks: 6, cta: { href: '/download' } },
  { id: 'pro', name: 'Pro', live: false, perks: 7 },
  { id: 'teams', name: 'Teams', live: false, perks: 5 },
]

// Ordem da tabela de fatos. O preço do crédito saiu do parágrafo de abertura na
// revisão de copy; fica aqui para não sumir da página — é o número que o
// visitante procura antes de baixar. `byok` e `local` são as duas saídas sem
// crédito, e ficam no fim de propósito: quem chega na página não quer escolher
// provedor, quer baixar.
const FACTS = [
  'Credit',
  'Payment',
  'Bonus',
  'Allowance',
  'Bought',
  'Byok',
  'Local',
] as const

export function Pricing(): React.JSX.Element {
  const t = useTranslations('pricing')

  return (
    <section id="planos" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Coluna do argumento */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="gb-display max-w-[14ch] text-[clamp(2.1rem,4.9vw,3.5rem)]">
              {t('title')}
            </h2>
            <p
              className="gb-measure mt-6 text-[16.5px] leading-relaxed"
              style={{ color: 'var(--ink-muted)' }}
            >
              {t('body')}
            </p>

            <dl className="mt-8 flex flex-col">
              {FACTS.map((fact, i) => (
                <div
                  key={fact}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                  style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
                >
                  <dt className="text-[14px] font-medium">{t(`fact${fact}K`)}</dt>
                  <dd className="text-[14px]" style={{ color: 'var(--ink-muted)' }}>
                    {t(`fact${fact}V`)}
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
                          {t('soon')}
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-2 max-w-[42ch] text-[14px] leading-relaxed"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {t(`${plan.id}Desc`)}
                    </p>
                  </div>

                  {plan.live ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="gb-display text-[40px]">{t('freePrice')}</span>
                      <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                        {t('freePeriod')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>
                      {t('priceAtLaunch')}
                    </span>
                  )}
                </div>

                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {Array.from({ length: plan.perks }, (_, n) => n + 1).map((n) => (
                    <li key={n} className="flex items-start gap-2.5 text-[14px]">
                      <span
                        className="mt-[3px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                        style={{ background: plan.live ? 'var(--accent)' : 'var(--hairline-strong)' }}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span style={{ color: 'var(--ink-muted)' }}>{t(`${plan.id}Perk${n}`)}</span>
                    </li>
                  ))}
                </ul>

                {plan.cta && (
                  <Link
                    href={plan.cta.href}
                    className="gb-btn gb-btn-primary mt-7 w-full px-5 py-3 text-[15px]"
                  >
                    {t('freeCta')}
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
