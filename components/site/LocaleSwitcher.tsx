'use client'

import { useLocale } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  type Locale,
} from '@/i18n/routing'

/**
 * Seletor de idioma do cabeçalho.
 *
 * SÃO ÂNCORAS DE VERDADE, não um `<select>` com `router.push`. Dois motivos:
 * o rastreador segue `<a href>` e assim descobre a versão em inglês sem depender
 * do `hreflang`; e quem abre em nova aba ou copia o link recebe a URL do outro
 * idioma, não a da página atual.
 *
 * O clique grava o cookie no CLIENTE porque a navegação é do próprio Next e não
 * volta ao middleware — sem esta linha, quem escolhe EN é mandado de volta para
 * o português na próxima vez que digitar o domínio sozinho.
 */
export function LocaleSwitcher({ className = '' }: { className?: string }): React.JSX.Element {
  const atual = useLocale() as Locale
  const caminho = usePathname()

  function lembrar(locale: Locale): void {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
  }

  return (
    <div
      className={`flex shrink-0 items-center rounded-[8px] p-[2px] ${className}`}
      style={{ border: '1px solid var(--hairline)' }}
    >
      {LOCALES.map((l) => {
        const ativo = l === atual
        return (
          <Link
            key={l}
            href={caminho}
            locale={l}
            hrefLang={l}
            onClick={() => lembrar(l)}
            aria-current={ativo ? 'true' : undefined}
            title={LOCALE_LABELS[l].long}
            className="rounded-[6px] px-2 py-[3px] text-[12px] font-medium leading-none transition-colors"
            style={
              ativo
                ? { background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--ink)' }
                : { color: 'var(--ink-faint)' }
            }
          >
            {LOCALE_LABELS[l].short}
            <span className="sr-only"> — {LOCALE_LABELS[l].long}</span>
          </Link>
        )
      })}
    </div>
  )
}
