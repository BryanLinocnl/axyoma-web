import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { AppMock } from './AppMock'
import planShot from '@/public/app/plan-mode.png'

const COLUMNS = ['col1', 'col2', 'col3'] as const

export function ScaleSection(): React.JSX.Element {
  const t = useTranslations('scale')

  return (
    <section className="gb-desk-band relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 pb-0 pt-20 sm:px-6 sm:pt-28 lg:pt-32">
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
      </div>

      {/* Mesma técnica do hero, espelhada: o painel entra pela esquerda e sai
          pela direita, para o olho não repetir o movimento do primeiro viewport. */}
      <div className="gb-stage relative mt-12 sm:mt-16">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          {/* Celular: mock. Mesma razão do hero — um print de 2668px espremido
              em 390 não se lê, e o mock é layout de verdade. */}
          <div className="w-full sm:hidden">
            <div className="gb-fade-bottom">
              <AppMock mode="plan" />
            </div>
          </div>

          {/* sm+ : o print real do modo Plan.
              Ocupa a largura toda; quem controla a altura é o RECORTE da
              imagem (2,08:1), não a escala do elemento — foi assim que deu pra
              alargar sem crescer na vertical. */}
          <div className="hidden sm:-ml-[8%] sm:block sm:w-[116%] lg:-ml-[5%] lg:w-[110%]">
            <div
              className="gb-tilt-right gb-fade-bottom overflow-hidden rounded-[14px]"
              style={{ border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-panel)' }}
            >
              <Image
                src={planShot}
                alt={t('imageAlt')}
                sizes="(max-width: 640px) 1px, 120vw"
                // Levemente translúcido de propósito: o fundo do app é um
                // cinza neutro e a mesa da página é branco-azulada, então o
                // painel opaco destoava como um bloco cinza colado por cima.
                // Deixar a mesa transparecer é o mesmo princípio dos materiais
                // de vidro do resto do design (ver DESIGN.md).
                className="block h-auto w-full opacity-[0.93]"
              />
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
          {COLUMNS.map((col) => (
            <div key={col}>
              <h3 className="text-[16px] font-semibold tracking-[-0.015em]">{t(`${col}Title`)}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {t(`${col}Body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
