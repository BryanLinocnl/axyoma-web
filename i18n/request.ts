import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, isLocale } from './routing'

// Ponte entre o segmento `[locale]` da URL e o catálogo de mensagens.
//
// `requestLocale` vem do parâmetro de rota; quando a rota não tem locale (uma
// 404 fora de `[locale]`, por exemplo) ele é `undefined` e caímos no padrão em
// vez de estourar — página de erro sem tradução ainda é página, página que
// lança não é.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
