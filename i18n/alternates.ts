import type { Metadata } from 'next'
import { DEFAULT_LOCALE, LOCALES, type Locale, localizedPath } from './routing'

/**
 * `hreflang` + `canonical` de uma página.
 *
 * POR QUE CADA PÁGINA CHAMA ISTO EM VEZ DE O LAYOUT RESOLVER SOZINHO: metadata
 * de layout não conhece o caminho da página filha, e um `hreflang` que aponta
 * todas as páginas para `/` e `/en` é pior que nenhum — diz ao Google que
 * `/docs` e `/en/recursos` são a mesma coisa. Como cada página conhece o
 * próprio caminho em tempo de compilação, o par fica correto E a página
 * continua estática (nada de ler `headers()` para descobrir a URL).
 *
 * Sem `hreflang` o Google trata pt-BR e en como conteúdo duplicado e escolhe
 * uma das duas para indexar — que é exatamente o ganho de SEO que motivou a
 * fase 1 da spec `multilingue.md`.
 *
 * @param path caminho SEM prefixo de idioma, começando com `/` (ex.: `/docs`).
 */
export function alternatesFor(path: string, locale: Locale): Metadata['alternates'] {
  const languages: Record<string, string> = {}
  for (const l of LOCALES) languages[l] = localizedPath(path, l)
  // `x-default` é a versão servida a quem o Google não conseguiu classificar.
  // É o português: é a URL sem prefixo, a que já está indexada.
  languages['x-default'] = localizedPath(path, DEFAULT_LOCALE)

  return { canonical: localizedPath(path, locale), languages }
}
