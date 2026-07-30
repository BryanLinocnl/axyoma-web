import '../globals.css'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
  Bricolage_Grotesque,
  Playfair_Display,
  JetBrains_Mono,
  Geist,
  Schibsted_Grotesk,
} from 'next/font/google'
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { LOCALES, type Locale } from '@/i18n/routing'
import { alternatesFor } from '@/i18n/alternates'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// Schibsted Grotesk é a face de UI do app desktop (ver Aplication/DESIGN.md).
// A landing usa a mesma para que o site e o produto tenham a mesma voz.
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  axes: ['opsz', 'wdth'],
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['italic', 'normal'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-playfair',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500', '600'],
})

const SITE_URL = 'https://axyoma.ia.br'

// Este é o layout RAIZ do site inteiro (não existe `app/layout.tsx`): tudo que
// tem página vive sob `[locale]`, inclusive `/conta`. É o único jeito de o
// atributo `lang` do <html> acompanhar o idioma sem transformar todas as páginas
// em dinâmicas — `headers()` num layout acima de `[locale]` tiraria o site
// inteiro da renderização estática só para ler duas letras.
export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata.site' })
  const title = t('title')
  const description = t('description')

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: '%s' },
    description,
    applicationName: 'Axyoma AI',
    // Uma string separada por vírgula no catálogo, não um array: JSON de
    // tradução com array vira lista de índices sem nome, e ninguém sabe o que
    // faltou traduzir.
    keywords: t('keywords').split(',').map((k) => k.trim()),
    alternates: alternatesFor('/', hasLocale(LOCALES, locale) ? locale : 'pt-BR'),
    openGraph: {
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'pt_BR',
      url: SITE_URL,
      siteName: 'Axyoma AI',
      title,
      description,
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  // Um `/xx/` qualquer não pode cair no português calado: seria a mesma página
  // servida em N URLs, que é exatamente o conteúdo duplicado que o hreflang
  // existe para evitar.
  if (!hasLocale(LOCALES, locale)) notFound()

  // Sem isto o next-intl marca a rota como dinâmica ao ler o locale, e a landing
  // — que é estática desde sempre — passaria a ser renderizada a cada visita.
  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        bricolage.variable,
        playfair.variable,
        jetbrains.variable,
        schibsted.variable,
        'font-sans',
        geist.variable,
      )}
    >
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
        {/* Web Analytics e Speed Insights da Vercel.
            Ficam DEPOIS do conteúdo e sem `<Script>` próprio: os dois já se
            carregam de forma diferida, então não competem com a primeira
            renderização — o que importa especialmente no Speed Insights, que
            mede justamente isso e não pode piorar o número que afere.
            A §11 da Política de Privacidade foi atualizada na mesma leva: ela
            afirmava não haver ferramenta de análise de audiência. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
