/**
 * A virada da página: o problema, antes das funcionalidades.
 *
 * A landing ia do herói direto para recurso — modos, controle, custo, planos.
 * Quem chega sem conhecer o produto lia uma lista de coisas que ele faz sem
 * nunca ler por que elas importam. Esta seção é o degrau que faltava.
 *
 * POR QUE ESTE PROBLEMA, E NÃO "O MODELO MUDA TODO MÊS". A tentação é vender
 * independência de modelo — "troque de modelo, não de ferramenta". É a frase
 * mais repetida da categoria: Cline, Roo, Continue, Aider e o próprio OpenRouter
 * dizem exatamente isso. Copy que o concorrente também assina não diferencia
 * nada.
 *
 * O que um concorrente dono da própria infraestrutura NÃO consegue assinar são
 * as duas afirmações abaixo, e por motivo estrutural, não por escolha: o negócio
 * dele depende de o tráfego passar por lá. Daí serem estas as escolhidas.
 *
 * As duas são verificáveis, não adjetivo:
 *   • com chave própria o turno sai da máquina direto ao fornecedor — dá para
 *     conferir no tráfego (spec `proxy-direto-provider.md`);
 *   • modelo local pelo Ollama não sai da máquina, e está no plano gratuito.
 *
 * Aqui só se afirma. A prova vem depois, em `LedgerSection` (custo por chamada)
 * e `RunSection` (as três formas de rodar) — por isso o texto é curto e não
 * repete o que aquelas seções detalham.
 */

import { useTranslations } from 'next-intl'

const ESCOLHAS = ['onde', 'quanto'] as const

export function ProblemSection(): React.JSX.Element {
  const t = useTranslations('problem')

  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">{t('title1')}</span>
          <span className="block" style={{ color: 'var(--ink-faint)' }}>
            {t('title2')}
          </span>
        </h2>

        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          {t('body')}
        </p>

        <div className="mt-14 border-t pt-12" style={{ borderColor: 'var(--hairline)' }}>
          <p className="text-[19px] font-medium">{t('lead')}</p>

          <div className="mt-9 grid gap-x-12 gap-y-9 md:grid-cols-2">
            {ESCOLHAS.map((e) => (
              <div key={e}>
                <h3 className="text-[16px] font-medium">{t(`${e}Title`)}</h3>
                <p
                  className="mt-2 text-[15px] leading-relaxed"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {t(`${e}Body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
