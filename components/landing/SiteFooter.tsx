import Link from 'next/link'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { EMPRESA } from '@/lib/empresa'

const LINKS = [
  { href: '/recursos', label: 'Recursos' },
  { href: '/contato', label: 'Sobre' },
  { href: '/docs', label: 'Docs' },
  { href: '/download', label: 'Download' },
  { href: '/contato', label: 'Contato' },
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/termos', label: 'Termos' },
]

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-white/10 bg-[#030304]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-2">
            <AxiomaLogo id="foot" className="h-5 w-5" />
            <span className="font-brand text-base text-white">Axyoma</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--ink-faint)]">
            {LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
            <a
              href={`mailto:${EMPRESA.email}`}
              className="transition-colors hover:text-white"
            >
              {EMPRESA.email}
            </a>
            {EMPRESA.social.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-white"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-2 border-t border-white/8 pt-5 text-xs text-[var(--ink-faint)] sm:flex-row sm:items-center">
          <p>
            © 2026 {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj} · {EMPRESA.cidade}
          </p>
          <p>
            Feita no{' '}
            <span className="font-brand text-[var(--ink-dim)]">Axyoma</span> IA
          </p>
        </div>
      </div>
    </footer>
  )
}
