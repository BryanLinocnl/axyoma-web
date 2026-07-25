import Link from 'next/link'
import Image from 'next/image'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { EMPRESA } from '@/lib/empresa'

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Produto',
    links: [
      { label: 'Baixar', href: '/download' },
      { label: 'Recursos', href: '/recursos' },
      { label: 'Planos', href: '#planos' },
      { label: 'Documentação', href: '/docs' },
    ],
  },
  {
    title: 'Conta',
    links: [
      { label: 'Entrar', href: '/login' },
      { label: 'Criar conta', href: '/signup' },
      { label: 'Créditos e faturamento', href: '/conta/faturamento' },
      { label: 'Contato', href: '/contato' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de uso', href: '/termos' },
      { label: 'Privacidade', href: '/privacidade' },
    ],
  },
]

const SYSTEMS: { label: string; icon: string | null }[] = [
  { label: 'macOS', icon: '/apple-logo-svgrepo-com.svg' },
  { label: 'Windows', icon: null },
  { label: 'Linux', icon: '/linux-svgrepo-com.svg' },
]

export function SiteFooter(): React.JSX.Element {
  return (
    <footer
      className="gb-desk relative overflow-hidden"
      style={{ borderTop: '1px solid var(--hairline)' }}
    >
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28">
        {/* Fecho da página: a última coisa é a ação, não a lista de links. */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h2 className="gb-display max-w-[13ch] text-[clamp(2rem,4.8vw,3.25rem)]">
              Instale e mande a primeira tarefa hoje.
            </h2>
            <p className="mt-5 text-[16px]" style={{ color: 'var(--ink-muted)' }}>
              400 créditos ao criar a conta. Sem cartão, sem chave de API.
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <Link
              href="/download"
              className="gb-btn gb-btn-primary w-fit px-6 py-3.5 text-[15px]"
            >
              Baixar o Axyoma
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
              Estúdio de engenharia com IA no seu desktop. Você aprova, o agente entrega.
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
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink-faint)' }}>
                {col.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] transition-colors hover:text-[var(--ink)]"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {l.label}
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
