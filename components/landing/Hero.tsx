import Link from 'next/link'
import { AppMock } from './AppMock'

export function Hero(): React.JSX.Element {
  return (
    <section className="gb-desk relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 pb-0 pt-32 sm:px-6 sm:pt-40 lg:pt-44">
        {/* Duas linhas explícitas: no template a manchete é um bloco de duas
            linhas cheias, e deixar o navegador quebrar sozinho dava três
            linhas desalinhadas em 1440. */}
        <h1 className="gb-display gb-lift text-[clamp(2.35rem,5.9vw,4.5rem)]">
          <span className="block">O agente faz o trabalho.</span>
          <span className="block">Você aprova cada passo.</span>
        </h1>

        <p
          className="gb-lift gb-measure mt-7 text-[17px] leading-relaxed sm:text-[18px]"
          style={{ color: 'var(--ink-muted)', animationDelay: '90ms' }}
        >
          App de desktop que planeja a feature, edita os seus arquivos, roda os comandos e abre o
          PR — sem chave de API e sem cota diária travando o meio do trabalho.
        </p>

        <div
          className="gb-lift mt-9 flex flex-wrap items-center gap-3"
          style={{ animationDelay: '160ms' }}
        >
          <Link href="/download" className="gb-btn gb-btn-primary px-6 py-3 text-[15px]">
            Baixar grátis
          </Link>
          <Link href="#modos" className="gb-btn gb-btn-ghost px-6 py-3 text-[15px]">
            Ver os três modos
          </Link>
        </div>

        <p
          className="gb-lift mt-5 text-[13.5px]"
          style={{ color: 'var(--ink-faint)', animationDelay: '220ms' }}
        >
          400 créditos ao criar a conta · sem cartão · macOS, Windows e Linux
        </p>
      </div>

      {/* O app pousado na mesa. Vaza pela direita e pelo rodapé de propósito:
          a tela continua além do viewport, como um objeto grande demais pra
          caber — é o que faz a página parecer uma bancada e não um slide. */}
      <div className="gb-stage mt-10 sm:mt-6">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          {/* settle no wrapper, tilt no filho — ver glass-bench.css */}
          <div className="gb-settle ml-0 w-full sm:ml-[8%] sm:w-[116%] lg:ml-[14%] lg:w-[110%]">
            <div className="gb-tilt gb-fade-bottom">
              <AppMock mode="code" />
            </div>
          </div>
        </div>
        <div className="h-4 sm:h-6" />
      </div>
    </section>
  )
}
