import './globals.css'
import type { Metadata } from 'next'
import { Bricolage_Grotesque, Playfair_Display, JetBrains_Mono } from 'next/font/google'

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

export const metadata: Metadata = {
  title: 'Axyoma — Crie sem limite de uso',
  description:
    'Desenhe para as redes, planeje a execução e rode o agente no mesmo app — com os melhores modelos e sem teto artificial de uso. Créditos que você controla. Sem chave de API. Sem montar stack.',
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  )
}
