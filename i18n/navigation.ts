import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from './routing'

/**
 * Navegação ciente do idioma.
 *
 * POR QUE ISTO PRECISA EXISTIR: com `pt-BR` sem prefixo, um `<Link href="/docs">`
 * do `next/link` leva quem está em `/en/recursos` de volta para o português sem
 * avisar. O `Link` daqui resolve o prefixo a partir do locale corrente — é a
 * diferença entre um site bilíngue e um site que cai para o português no
 * primeiro clique.
 *
 * O `routing` abaixo descreve para o next-intl a MESMA regra que o
 * `middleware.ts` implementa na mão (`as-needed`, padrão `pt-BR`). Se um dia
 * uma das duas mudar, a outra tem que mudar junto — o middleware é caseiro
 * porque precisa conviver com o gate de auth de `/conta`, que o middleware
 * pronto do next-intl atropelaria.
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeCookie: { name: LOCALE_COOKIE },
})

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
