import './globals.css'
import type { Metadata } from 'next'
import {
  Bricolage_Grotesque,
  Playfair_Display,
  JetBrains_Mono,
  Geist,
  Schibsted_Grotesk,
} from 'next/font/google'
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider'

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
const SITE_DESC =
  'Planeje, execute e acompanhe tarefas com Gemini, Claude, GPT, Grok, DeepSeek e centenas de outros modelos. Comece com créditos inclusos ou conecte sua própria API. Você escolhe como usar.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Axyoma — Trabalhe com qualquer IA. Em um único lugar.',
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
    title: 'Axyoma — Trabalhe com qualquer IA. Em um único lugar.',
    description: SITE_DESC,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Axyoma — Trabalhe com qualquer IA. Em um único lugar.',
    description: SITE_DESC,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html
      lang="pt-BR"
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
