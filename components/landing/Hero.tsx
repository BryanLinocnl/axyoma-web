import Link from 'next/link'
import Image from 'next/image'
import { AppMock } from './AppMock'
import heroShot from '@/public/app/section-hero.png'

export function Hero(): React.JSX.Element {
  return (
    <section className="gb-desk relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 pb-0 pt-32 sm:px-6 sm:pt-40 lg:pt-44">
        {/* Duas linhas explícitas: no template a manchete é um bloco de duas
            linhas cheias, e deixar o navegador quebrar sozinho dava três
            linhas desalinhadas em 1440. */}
        <h1 className="gb-display gb-lift text-[clamp(2.35rem,5.9vw,4.5rem)]">
          <span className="block">Trabalhe com qualquer IA.</span>
          <span className="block">Em um único lugar.</span>
        </h1>

        <p
          className="gb-lift gb-measure mt-7 text-[17px] leading-relaxed sm:text-[18px]"
          style={{ color: 'var(--ink-muted)', animationDelay: '90ms' }}
        >
          Planeje, execute e acompanhe tarefas com Gemini, Claude, GPT, Grok, DeepSeek e centenas
          de outros modelos. Comece com créditos inclusos ou conecte sua própria API. Você escolhe
          como usar.
        </p>

        <div
          className="gb-lift mt-9 flex flex-wrap items-center gap-3"
          style={{ animationDelay: '160ms' }}
        >
          <Link href="/download" className="gb-btn gb-btn-primary px-6 py-3 text-[15px]">
            Baixar grátis
          </Link>
          <Link href="#controle" className="gb-btn gb-btn-ghost px-6 py-3 text-[15px]">
            Ver como funciona
          </Link>
        </div>

        <p
          className="gb-lift mt-5 text-[13.5px]"
          style={{ color: 'var(--ink-faint)', animationDelay: '220ms' }}
        >
          400 créditos para começar · sem cartão · Windows, macOS e Linux
        </p>
      </div>

      {/* O app pousado na mesa. Vaza pela direita e pelo rodapé de propósito:
          a tela continua além do viewport, como um objeto grande demais pra
          caber — é o que faz a página parecer uma bancada e não um slide.

          O print entra AQUI DENTRO do mesmo palco que segurava o <AppMock/>:
          a inclinação e a máscara de fade vivem no wrapper, então trocar mock
          por imagem (ou o contrário) não mexe em layout nenhum.

          `import` estático em vez de string: o next/image lê largura e altura
          do arquivo em tempo de build, o que evita layout shift e me poupa de
          manter as dimensões na mão a cada troca de print. */}
      <div className="gb-stage mt-10 sm:mt-6">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          {/* settle no wrapper, tilt no filho — ver glass-bench.css */}
          {/* CELULAR: mock, não o print.
              O print é uma janela de 3360px. Cabendo em 390 o texto some; para
              ficar legível ele precisaria de ~4x a largura da tela, e aí só a
              sidebar apareceria. O mock é layout de verdade — recolhe a
              sidebar, mantém a conversa legível e pesa quase nada. */}
          <div className="gb-settle w-full sm:hidden">
            <div className="gb-fade-bottom">
              <AppMock mode="code" />
            </div>
          </div>

          {/* sm+ : o print real, que é onde ele tem espaço pra ser lido. */}
          <div className="gb-settle hidden sm:ml-[8%] sm:block sm:w-[116%] lg:ml-[14%] lg:w-[110%]">
            <div
              className="gb-tilt gb-fade-bottom overflow-hidden rounded-[14px]"
              style={{ border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-panel)' }}
            >
              <Image
                src={heroShot}
                alt="Axyoma no modo Code: o agente busca imagens na web, roda comandos no terminal e resume o que fez."
                priority
                sizes="(max-width: 640px) 1px, 130vw"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </div>
        <div className="h-4 sm:h-6" />
      </div>
    </section>
  )
}
