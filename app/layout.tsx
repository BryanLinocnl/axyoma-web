import './globals.css'
import type { Metadata } from 'next'
import { Bricolage_Grotesque, Playfair_Display, JetBrains_Mono, Geist } from 'next/font/google'
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
const SITE_DESC =
  'Desenhe para as redes, planeje a execução e rode o agente no mesmo app — com os melhores modelos e sem teto artificial de uso. Créditos que você controla. Sem chave de API. Sem montar stack.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Axyoma — Crie sem limite de uso',
    template: '%s',
  },
  description: SITE_DESC,
  applicationName: 'Axyoma AI',
  keywords: ['Axyoma', 'IA', 'agente de código', 'estúdio de engenharia', 'design com IA', 'créditos'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Axyoma AI',
    title: 'Axyoma — Crie sem limite de uso',
    description: SITE_DESC,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Axyoma — Crie sem limite de uso',
    description: SITE_DESC,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn(bricolage.variable, playfair.variable, jetbrains.variable, "font-sans", geist.variable)}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
