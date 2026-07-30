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
  const t = await getTranslations({ locale, namespace: 'metadata.docs' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/docs', locale),
  }
}

// LINUX: instruções de instalação para um arquivo que não está publicado são
// pior que ausência — mandam a pessoa procurar um download que não existe. Por
// isso `instalacaoLinux` fala de indisponibilidade em vez de ensinar o AppImage.
const INSTALACAO = ['Macos', 'Windows', 'Linux'] as const
const MODOS = ['Design', 'Plan', 'Code'] as const

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('docs')

  return (
    <ContentPage title={t('title')} intro={t('intro')}>
      <Secao titulo={t('instalacaoTitle')}>
        <p>
          {t.rich('instalacaoBody', {
            download: (chunks) => <A href="/download">{chunks}</A>,
          })}
        </p>
        {INSTALACAO.map((nome) => (
          <Card key={nome}>
            {/* O nome do sistema é marca (macOS, Windows, Linux) e por isso fica
                no código, não no catálogo. */}
            <p className="text-lg font-semibold text-neutral-900">
              {nome === 'Macos' ? 'macOS' : nome}
            </p>
            <p className="mt-1 text-neutral-600">{t(`instalacao${nome}`)}</p>
          </Card>
        ))}
      </Secao>

      <Secao titulo={t('loginTitle')}>
        {/* APPLE: fora enquanto o provedor não estiver configurado. */}
        <p>{t('loginBody')}</p>
      </Secao>

      <Secao titulo={t('modeloTitle')}>
        <p>{t('modeloBody')}</p>
      </Secao>

      <Secao titulo={t('modosTitle')}>
        {MODOS.map((nome) => (
          <Card key={nome}>
            <p className="text-lg font-semibold text-neutral-900">{nome}</p>
            <p className="mt-1 text-neutral-600">{t(`modos${nome}`)}</p>
          </Card>
        ))}
      </Secao>

      <Secao titulo={t('creditosTitle')}>
        <p>{t('creditosBody1')}</p>
        <p>{t('creditosBody2')}</p>
      </Secao>

      <Secao titulo={t('ajudaTitle')}>
        <p>
          {t.rich('ajudaBody', {
            contato: (chunks) => <A href="/contato">{chunks}</A>,
          })}
        </p>
      </Secao>
    </ContentPage>
  )
}
