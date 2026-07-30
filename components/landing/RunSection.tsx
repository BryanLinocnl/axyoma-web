/**
 * Onde o modelo roda, e quem paga por ele.
 *
 * A landing vendia um produto menor do que o que existe: não dizia que dá para
 * usar chave própria, nem que dá para rodar modelo local sem custo e sem
 * internet. Eram justamente os dois caminhos em que o que o usuário escreve NÃO
 * passa pelos nossos servidores — o argumento mais forte do produto, ausente da
 * página.
 *
 * A privacidade aqui é consequência da arquitetura, não promessa de política.
 * Por isso o texto descreve o CAMINHO ("vai da sua máquina direto ao
 * fornecedor"), que é verificável no tráfego, em vez de prometer conduta
 * ("respeitamos seus dados"), que não é.
 */

import { useTranslations } from 'next-intl'

// `selo` continua no tipo (nenhuma via usa hoje) porque é o gancho de "Em breve"
// por via — a alternativa seria reintroduzir a coluna inteira quando a Anthropic
// com chave própria entrar.
const VIAS: { id: 'creditos' | 'byok' | 'local'; selo?: string }[] = [
  { id: 'creditos' },
  { id: 'byok' },
  { id: 'local' },
]

export function RunSection(): React.JSX.Element {
  const t = useTranslations('run')

  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">{t('title1')}</span>
          <span className="block">{t('title2')}</span>
        </h2>
        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          {t('body')}
        </p>

        <div className="mt-14 grid gap-px lg:grid-cols-3" style={{ background: 'var(--hairline)' }}>
          {VIAS.map((via) => (
            <div
              key={via.id}
              className="flex flex-col gap-4 p-7 sm:p-8"
              style={{ background: 'var(--surface, transparent)' }}
            >
              <div className="flex items-baseline gap-2">
                <h3 className="text-[19px] font-medium">{t(`${via.id}Title`)}</h3>
                {via.selo && (
                  <span
                    className="gb-mono rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-wide"
                    style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-muted)' }}
                  >
                    {via.selo}
                  </span>
                )}
              </div>

              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {t(`${via.id}Body`)}
              </p>

              <ul className="mt-1 flex flex-col gap-2.5">
                {([1, 2, 3] as const).map((n) => (
                  <li key={n} className="flex gap-2.5 text-[14px] leading-relaxed">
                    <span
                      className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: 'var(--accent)' }}
                      aria-hidden
                    />
                    <span style={{ color: 'var(--ink-muted)' }}>{t(`${via.id}Item${n}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
          {t('footnote')}
        </p>
      </div>
    </section>
  )
}
