// Ver o comentário em SiteNav.tsx: href cru derruba o visitante para o pt-BR.
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { EMPRESA } from '@/lib/empresa'

// Rótulos viraram chaves (`footer.<coluna><Item>`); o href continua cru — é
// rota, não texto.
const COLUMNS: { id: 'produto' | 'conta' | 'legal'; links: { key: string; href: string }[] }[] = [
  {
    id: 'produto',
    links: [
      { key: 'produtoDownload', href: '/download' },
      { key: 'produtoRecursos', href: '/recursos' },
      { key: 'produtoPlanos', href: '#planos' },
      { key: 'produtoDocs', href: '/docs' },
    ],
  },
  {
    id: 'conta',
    links: [
      { key: 'contaLogin', href: '/login' },
      { key: 'contaSignup', href: '/signup' },
      { key: 'contaFaturamento', href: '/conta/faturamento' },
      { key: 'contaContato', href: '/contato' },
    ],
  },
  {
    id: 'legal',
    links: [
      { key: 'legalTermos', href: '/termos' },
      { key: 'legalPrivacidade', href: '/privacidade' },
    ],
  },
]

// LINUX: o ícone aqui funciona como promessa de download — devolver junto com o
// AppImage, não antes.
const SYSTEMS: { label: string; icon: string | null }[] = [
  { label: 'macOS', icon: '/apple-logo-svgrepo-com.svg' },
  { label: 'Windows', icon: null },
]

export function SiteFooter(): React.JSX.Element {
  const t = useTranslations('footer')

  return (
    <footer
      className="gb-desk relative overflow-hidden"
      style={{ borderTop: '1px solid var(--hairline)' }}
    >
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28">
        {/* Fecho da página: a última coisa é a ação, não a lista de links. */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h2 className="gb-display max-w-[15ch] text-[clamp(2rem,4.4vw,3rem)]">
              {t('headline')}
            </h2>
            <p className="gb-measure mt-5 text-[16px]" style={{ color: 'var(--ink-muted)' }}>
              {t('body')}
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <Link
              href="/download"
              className="gb-btn gb-btn-primary w-fit px-6 py-3.5 text-[15px]"
            >
              {t('cta')}
            </Link>
            <ul className="flex items-center gap-5">
              {SYSTEMS.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center gap-1.5 text-[13px]"
                  style={{ color: 'var(--ink-faint)' }}
                >
                  {s.icon && (
                    <Image
                      src={s.icon}
                      alt=""
                      width={13}
                      height={13}
                      unoptimized
                      aria-hidden
                      className="h-[13px] w-[13px] opacity-60 dark:[filter:invert(1)]"
                    />
                  )}
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-16 grid gap-10 pt-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]"
          style={{ borderTop: '1px solid var(--hairline)' }}
        >
          <div>
            <Link href="/" className="flex items-center gap-2">
              <AxiomaLogo id="footer" className="h-6 w-6" />
              <span className="gb-display text-[19px]" style={{ letterSpacing: '-0.025em' }}>
                Axyoma
              </span>
            </Link>
            <p className="mt-3 max-w-[32ch] text-[14px]" style={{ color: 'var(--ink-muted)' }}>
              {t('tagline')}
            </p>
            <a
              href={`mailto:${EMPRESA.email}`}
              className="mt-3 inline-block text-[14px] transition-colors hover:text-[var(--ink)]"
              style={{ color: 'var(--ink-muted)' }}
            >
              {EMPRESA.email}
            </a>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.id} aria-label={t(`${col.id}Title`)}>
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink-faint)' }}>
                {t(`${col.id}Title`)}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.key}>
                    <Link
                      href={l.href}
                      className="text-[14px] transition-colors hover:text-[var(--ink)]"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Identidade da empresa — exigida por revisão (Google for Startups) e
            pelas páginas legais. Não remover. */}
        <p className="mt-14 text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
          © {new Date().getFullYear()} {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj} ·{' '}
          {EMPRESA.cidade}
        </p>
      </div>
    </footer>
  )
}
