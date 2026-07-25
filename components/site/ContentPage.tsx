import Link from 'next/link'
import { AxiomaMark } from '@/components/AxiomaMark'

// Casca das páginas institucionais/legais (privacidade, termos, contato).
// Mundo Glass Bench (ver DESIGN.md): mesa clara, azul como único acento,
// Bricolage no título. Antes usava cinzas e laranja cravados na mão, de antes
// do redesign — e essas páginas são justamente as que um revisor abre.
export function ContentPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="glass-site">
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-[900px] px-6 py-14 sm:py-16">
          <div className="mb-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                className="grid size-9 place-items-center rounded-full text-white"
                style={{ background: 'linear-gradient(to top, #1e40af, #2563eb)' }}
              >
                <AxiomaMark className="size-5" />
              </span>
              <span className="font-brand text-[22px] leading-none tracking-tight">Axyoma</span>
            </Link>
            <Link
              href="/download"
              className="text-[15px] font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              Baixar o app
            </Link>
          </div>

          <h1 className="gb-display text-[clamp(2.1rem,4.6vw,3.25rem)]">{title}</h1>
          {intro ? (
            <p className="gb-measure mt-5 text-[17px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              {intro}
            </p>
          ) : null}

          <div
            className="mt-14 flex flex-col gap-12 text-[16.5px] leading-relaxed"
            style={{ color: 'var(--ink-muted)' }}
          >
            {children}
          </div>

          <div
            className="mt-16 border-t pt-6 text-[15px]"
            style={{ borderColor: 'var(--hairline)', color: 'var(--ink-faint)' }}
          >
            <Link href="/" className="underline underline-offset-4">
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

// Seção padrão: título sólido em preto (sem degradê/itálico) + corpo.
export function Secao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h2
        className="mb-4 text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]"
        style={{ color: 'var(--ink)' }}
      >
        {titulo}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

// Painel para itens de FAQ e blocos de destaque.
export function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="gb-raised rounded-[16px] p-6" style={{ border: '1px solid var(--hairline)' }}>
      {children}
    </div>
  )
}

// Link de destaque no acento azul (o laranja é reservado à marca).
export function A({ href, children }: { href: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a
      href={href}
      className="font-medium underline underline-offset-2"
      style={{ color: 'var(--accent)' }}
    >
      {children}
    </a>
  )
}
