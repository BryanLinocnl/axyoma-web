import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ContentPage, Secao, Card, A } from '@/components/site/ContentPage'
import { alternatesFor } from '@/i18n/alternates'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata.recursos' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/recursos', locale),
  }
}

// Nome do modo é marca do produto (Design/Plan/Code): fica no código.
const MODOS = ['Design', 'Plan', 'Code'] as const

const FERRAMENTAS = [
  'Arquivos',
  'Comandos',
  'Depuracao',
  'Busca',
  'Screenshot',
  'Subagentes',
  'Skills',
] as const

// LINUX: `vantagemMulti` sai de macOS+Windows enquanto o AppImage não volta a
// ser gerado.
const VANTAGENS = ['Chaves', 'Uso', 'Modelos', 'Agente', 'Controle', 'Multi'] as const

export default async function RecursosPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('recursos')
  const strong = (chunks: React.ReactNode): React.JSX.Element => (
    <strong className="text-neutral-900">{chunks}</strong>
  )

  return (
    <ContentPage title={t('title')} intro={t('intro')}>
      <Secao titulo={t('modosTitle')}>
        <p>{t('modosBody')}</p>
        {MODOS.map((nome) => (
          <Card key={nome}>
            <p className="text-xl font-semibold text-neutral-900">{nome}</p>
            <p className="mt-2 text-neutral-600">{t(`modos${nome}`)}</p>
          </Card>
        ))}
      </Secao>

      <Secao titulo={t('ferramentasTitle')}>
        <p>{t('ferramentasBody')}</p>
        <div className="flex flex-col gap-3">
          {FERRAMENTAS.map((id) => (
            <Card key={id}>
              <p className="text-lg font-semibold text-neutral-900">{t(`ferramenta${id}Nome`)}</p>
              <p className="mt-1 text-neutral-600">{t(`ferramenta${id}`)}</p>
            </Card>
          ))}
        </div>
      </Secao>

      <Secao titulo={t('modelosTitle')}>
        <p>{t('modelosBody')}</p>
      </Secao>

      <Secao titulo={t('creditosTitle')}>
        <p>{t('creditosBody1')}</p>
        <p>{t.rich('creditosBody2', { strong })}</p>
        <p>{t.rich('creditosBody3', { strong })}</p>
      </Secao>

      <Secao titulo={t('skillsTitle')}>
        <p>{t('skillsBody')}</p>
      </Secao>

      <Secao titulo={t('githubTitle')}>
        <p>{t('githubBody')}</p>
      </Secao>

      <Secao titulo={t('plataformasTitle')}>
        <p>{t('plataformasBody')}</p>
      </Secao>

      <Secao titulo={t('porqueTitle')}>
        <div className="flex flex-col gap-3">
          {VANTAGENS.map((id) => (
            <Card key={id}>
              <p className="text-lg font-semibold text-neutral-900">{t(`vantagem${id}Nome`)}</p>
              <p className="mt-1 text-neutral-600">{t(`vantagem${id}`)}</p>
            </Card>
          ))}
        </div>
        <p>
          {t.rich('fecho', {
            download: (chunks) => <A href="/download">{chunks}</A>,
            docs: (chunks) => <A href="/docs">{chunks}</A>,
          })}
        </p>
      </Secao>
    </ContentPage>
  )
}
