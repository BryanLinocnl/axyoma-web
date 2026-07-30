'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { LocaleSwitcher } from '@/components/site/LocaleSwitcher'
// `Link` do i18n, não o do `next/link`: com `pt-BR` sem prefixo, um href cru
// levaria quem está em `/en` de volta ao português no primeiro clique.
import { Link } from '@/i18n/navigation'

// O rótulo virou CHAVE do catálogo. A âncora (`#modos`, `#controle`) continua
// crua de propósito: ela casa com o `id` da seção no DOM, não com o texto — se
// alguém traduzir o href junto com o rótulo, o menu para de rolar para lugar
// nenhum e ninguém percebe até clicar.
const NAV_ITEMS = [
  { key: 'modos', href: '#modos' },
  { key: 'controle', href: '#controle' },
  { key: 'planos', href: '#planos' },
  { key: 'faq', href: '#faq' },
  { key: 'docs', href: '/docs' },
] as const

/**
 * Toolbar de vidro — o mesmo material da top bar do app. É um dos dois lugares
 * da página onde o `backdrop-filter` tem função real: existe conteúdo rolando
 * por baixo pra desfocar.
 */
export function SiteNav(): React.JSX.Element {
  const t = useTranslations('nav')
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:pt-4">
      <nav
        className={`gb-glass mx-auto flex items-center gap-3 rounded-[14px] transition-all duration-300 ${
          scrolled ? 'max-w-[880px] px-3 py-2' : 'max-w-[1160px] px-4 py-2.5'
        }`}
        style={{ border: '1px solid var(--hairline)' }}
        aria-label={t('ariaLabel')}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <AxiomaLogo id="nav" className="h-[22px] w-[22px]" />
          <span className="gb-display text-[17px]" style={{ letterSpacing: '-0.025em' }}>
            Axyoma
          </span>
        </Link>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="rounded-[8px] px-3 py-1.5 text-[13.5px] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
                style={{ color: 'var(--ink-muted)' }}
              >
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <LocaleSwitcher />
          <Link
            href="/login"
            className="hidden px-3 py-1.5 text-[13.5px] transition-colors hover:text-[var(--ink)] sm:block"
            style={{ color: 'var(--ink-muted)' }}
          >
            {t('login')}
          </Link>
          <Link href="/download" className="gb-btn gb-btn-primary px-4 py-2 text-[13.5px]">
            {t('download')}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('closeMenu') : t('openMenu')}
            className="grid h-8 w-8 place-items-center rounded-[8px] md:hidden"
            style={{ border: '1px solid var(--hairline)' }}
          >
            <span className="flex flex-col gap-[3px]" aria-hidden>
              <span className="block h-[1.5px] w-[14px]" style={{ background: 'var(--ink)' }} />
              <span className="block h-[1.5px] w-[14px]" style={{ background: 'var(--ink)' }} />
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <div
          className="gb-glass mx-auto mt-2 max-w-[1160px] rounded-[14px] p-2 md:hidden"
          style={{ border: '1px solid var(--hairline)' }}
        >
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-[8px] px-3 py-2.5 text-[15px]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-[8px] px-3 py-2.5 text-[15px]"
                style={{ color: 'var(--ink-muted)' }}
              >
                {t('login')}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
