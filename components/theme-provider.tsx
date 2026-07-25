'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    // Claro por padrão: o app desktop foi redesenhado para o mundo macOS Glass,
    // que é claro (Aplication/DESIGN.md), e a landing acompanha. O escuro
    // continua disponível pelo seletor de tema em /conta.
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
