// =============================================================================
// Configuração de idiomas do site — FONTE ÚNICA.
//
// Só `pt-BR` e `en` (spec `multilingue.md` §3). Sueco e espanhol ficam fora até
// haver número do Analytics: tradução que ninguém mantém a cada release vira
// texto que descreve um produto que não existe mais, e isso é pior do que a
// página em outro idioma.
//
// `pt-BR` é o PADRÃO E NÃO APARECE NA URL. A landing já está indexada em
// `axyoma.ia.br/`, `/docs`, `/recursos`… — passar essas URLs para `/pt-BR/…`
// jogaria fora o SEO que justamente motivou este trabalho. Quem mexer aqui
// precisa saber disso antes de trocar o `defaultLocale`.
// =============================================================================

export const LOCALES = ['pt-BR', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'pt-BR'

/**
 * Cookie com a escolha do visitante. O nome é o convencionado pelo Next/
 * next-intl (`NEXT_LOCALE`) de propósito: se um dia trocarmos a negociação
 * caseira do middleware pela do next-intl, a preferência de quem já visitou
 * continua valendo em vez de zerar.
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/** Um ano. A escolha de idioma não é uma sessão — é uma preferência. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale)
}

/** Rótulos do seletor. Cada idioma no próprio idioma, nunca traduzido. */
export const LOCALE_LABELS: Record<Locale, { short: string; long: string }> = {
  'pt-BR': { short: 'PT', long: 'Português' },
  en: { short: 'EN', long: 'English' },
}

/**
 * Prefixo do locale numa URL. O padrão não tem prefixo (ver o topo do arquivo),
 * então esta é a única função que decide como um caminho vira URL — usar
 * template string na mão em outro lugar é como o `/pt-BR/` volta a vazar.
 */
export function localizedPath(path: string, locale: Locale): string {
  const clean = path === '/' ? '' : path
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}
