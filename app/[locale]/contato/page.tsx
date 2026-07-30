import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ContentPage, Secao, Card, A } from '@/components/site/ContentPage'
import { EMPRESA } from '@/lib/empresa'
import { alternatesFor } from '@/i18n/alternates'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata.contato' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/contato', locale),
  }
}

const FAQ = ['Oque', 'Creditos', 'Modelos', 'Planos', 'Sistemas', 'Pagamento'] as const

export default async function ContatoPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('contato')

  return (
    <ContentPage title={t('title')} intro={t('intro')}>
      <Secao titulo={t('sobreTitle')}>
        <p>{t('sobreBody1', { produto: EMPRESA.produto })}</p>
        <p>
          {t.rich('sobreBody2', {
            recursos: (chunks) => <A href="/recursos">{chunks}</A>,
          })}
        </p>
        {/* Identidade da empresa — exigida por revisão (Google for Startups) e
            pelas páginas legais. Razão social e CNPJ NÃO são traduzidos. */}
        <p>
          {t('sobreOperado', {
            razaoSocial: EMPRESA.razaoSocial,
            cnpj: EMPRESA.cnpj,
            cidade: EMPRESA.cidade,
          })}
        </p>
      </Secao>

      <Secao titulo={t('faleTitle')}>
        <p>
          {t('faleBody')} <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A>.
        </p>
      </Secao>

      <Secao titulo={t('faqTitle')}>
        {FAQ.map((id) => (
          <Card key={id}>
            <p className="text-lg font-semibold text-neutral-900">{t(`faq${id}Q`)}</p>
            <p className="mt-2 text-neutral-600">{t(`faq${id}A`)}</p>
          </Card>
        ))}
      </Secao>
    </ContentPage>
  )
}
