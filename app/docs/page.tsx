import Link from 'next/link'
import { AxiomaLogo } from '@/components/AxiomaLogo'

const SECTIONS = [
  {
    t: 'Começando',
    items: [
      ['Instalação', 'Baixe o app, instale e faça login com sua conta AXYOMA.'],
      ['Créditos', 'Cada conta nova ganha 100 créditos. 1 crédito = R$ 0,30. Você só paga o que usa.'],
      ['Escolher modelo', 'Em Config → Modelos, adicione os modelos que quer no seletor do chat.'],
    ],
  },
  {
    t: 'Os três modos',
    items: [
      ['Design', 'Crie posts, carrosséis e motions para redes sociais.'],
      ['Plan', 'Planeje features em tarefas antes de executar.'],
      ['Code', 'Um agente que lê, escreve e edita seu projeto, roda comandos e entrega.'],
    ],
  },
  {
    t: 'Conta e cobrança',
    items: [
      ['Comprar créditos', 'Na aba Conta do app ou no site, compre créditos via PIX.'],
      ['Histórico de uso', 'Veja quanto cada turno consumiu em Conta → Uso recente.'],
    ],
  },
]

export default function DocsPage(): React.JSX.Element {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <AxiomaLogo id="docs" className="h-7 w-7" />
          <span className="font-brand text-lg italic">Axyoma</span>
        </Link>
        <Link href="/download" className="text-sm text-[var(--brand-2)] underline">
          Baixar o app
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Documentação</h1>
      <p className="mb-10 text-sm text-[var(--ink-dim)]">
        Guia rápido do AXYOMA AI. Mais conteúdo em breve.
      </p>

      <div className="flex flex-col gap-10">
        {SECTIONS.map((sec) => (
          <section key={sec.t}>
            <h2 className="mb-4 text-lg font-semibold brand-text inline-block font-brand italic">{sec.t}</h2>
            <div className="flex flex-col gap-3">
              {sec.items.map(([title, body]) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-[var(--ink-dim)]">{body}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
