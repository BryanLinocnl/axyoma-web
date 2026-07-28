import type { Metadata } from 'next'
import Link from 'next/link'
import { AxiomaMark } from '@/components/AxiomaMark'
import { DownloadPicker } from '@/components/download/DownloadPicker'
import { getLatestRelease } from '@/lib/releases'

export const metadata: Metadata = {
  title: 'Baixar o Axyoma',
  description:
    'Instaladores do Axyoma para macOS (Apple Silicon e Intel), Windows e Linux. Grátis, com 100 créditos para começar.',
}

// Server component: resolve a última release no servidor (com cache), e só a
// escolha do instalador — que depende da máquina de quem visita — roda no
// cliente. Assim o HTML já chega com todos os links prontos, inclusive para
// quem tem JavaScript desligado.
export default async function DownloadPage(): Promise<React.JSX.Element> {
  const release = await getLatestRelease()

  return (
    <div className="glass-site">
      <main className="gb-desk flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <Link href="/" className="mb-9 flex items-center gap-3">
          <span
            className="grid size-12 place-items-center rounded-full text-white"
            style={{ background: 'linear-gradient(to top, #1e40af, #2563eb)' }}
          >
            <AxiomaMark className="size-7" />
          </span>
          <span className="font-brand text-[30px] leading-none tracking-tight">Axyoma</span>
        </Link>

        <h1 className="gb-display max-w-[16ch] text-[clamp(2rem,5vw,3.25rem)]">
          Instale e comece em minutos.
        </h1>
        <p
          className="mt-5 max-w-[46ch] text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          Grátis. Crie sua conta e receba 100 créditos para começar — sem cartão, sem chave de API.
        </p>

        <DownloadPicker installers={release.installers} version={release.version} />

        {/* Não existe link para a página de releases do GitHub: de lá dá para
            baixar versões antigas, que podem ter falhas já corrigidas. A página
            oferece só o que é atual. */}
        <p
          className="mt-12 border-t pt-8 text-[13.5px]"
          style={{ color: 'var(--ink-faint)', borderColor: 'var(--hairline)' }}
        >
          Já tem o app?{' '}
          <Link href="/conta/visao-geral/visao-geral" className="underline underline-offset-4">
            Acesse sua conta
          </Link>
        </p>
      </main>
    </div>
  )
}
