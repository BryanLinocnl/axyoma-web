import Link from 'next/link'
import { AxiomaLogo } from '@/components/AxiomaLogo'

// Casca das páginas institucionais/legais (privacidade, termos, contato).
// Tema CLARO, alinhado ao design do app: fundo branco, texto quase-preto,
// títulos sólidos (sem degradê), tipografia grande, container 1024px.
// Cores fixas de propósito — independentes do tema escuro da landing.
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
    <main className="min-h-screen bg-white text-neutral-700">
      <div className="mx-auto w-full max-w-[1024px] px-6 py-14 sm:py-16">
        <div className="mb-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <AxiomaLogo id="content" className="h-8 w-8" />
            <span className="font-brand text-xl text-neutral-900">Axyoma</span>
          </Link>
          <Link
            href="/download"
            className="text-base font-medium text-orange-600 transition-colors hover:text-orange-700"
          >
            Baixar o app
          </Link>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
          {title}
        </h1>
        {intro ? <p className="mt-4 text-lg text-neutral-500">{intro}</p> : null}

        <div className="mt-14 flex flex-col gap-12 text-lg leading-relaxed">{children}</div>

        <div className="mt-16 border-t border-neutral-200 pt-6 text-base text-neutral-500">
          <Link href="/" className="underline underline-offset-4 hover:text-neutral-900">
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
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
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        {titulo}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

// Card claro para itens de FAQ e blocos de destaque.
export function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">{children}</div>
  )
}

// Link de destaque (laranja da marca) com bom contraste no branco.
export function A({ href, children }: { href: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a href={href} className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700">
      {children}
    </a>
  )
}
