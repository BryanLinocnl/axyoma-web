/**
 * Onde o modelo roda, e quem paga por ele.
 *
 * A landing vendia um produto menor do que o que existe: não dizia que dá para
 * usar chave própria, nem que dá para rodar modelo local sem custo e sem
 * internet. Eram justamente os dois caminhos em que o que o usuário escreve NÃO
 * passa pelos nossos servidores — o argumento mais forte do produto, ausente da
 * página.
 *
 * A privacidade aqui é consequência da arquitetura, não promessa de política.
 * Por isso o texto descreve o CAMINHO ("vai da sua máquina direto ao
 * fornecedor"), que é verificável no tráfego, em vez de prometer conduta
 * ("respeitamos seus dados"), que não é.
 */

const VIAS: { titulo: string; resumo: string; itens: string[]; selo?: string }[] = [
  {
    titulo: 'Créditos Axyoma',
    resumo: 'Sem chave, sem configurar nada. Você entra e usa.',
    itens: [
      'Catálogo completo — Gemini, Claude, GPT, Grok, Llama, DeepSeek e outros',
      'Débito pelo custo real do modelo, visível a cada execução',
      'Sem cota diária: o teto é quanto você decide gastar',
    ],
  },
  {
    titulo: 'Sua própria chave',
    resumo: 'Você paga o fornecedor direto. Nenhum crédito é consumido.',
    itens: [
      'OpenRouter e OpenAI',
      'A chave fica na sua máquina, cifrada pelo sistema',
      'O turno vai da sua máquina DIRETO ao fornecedor — a chave e o que você escreve não passam pelos nossos servidores',
    ],
  },
  {
    titulo: 'Modelos locais',
    resumo: 'Rodam no seu computador. Sem custo e sem internet.',
    itens: [
      'Ollama integrado: instalar, baixar e remover pelo próprio app',
      'Nada do que você escreve sai da máquina',
      'Disponível no plano gratuito',
    ],
  },
]

export function RunSection(): React.JSX.Element {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">Três formas de rodar.</span>
          <span className="block">Você escolhe modelo a modelo.</span>
        </h2>
        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          Nenhuma delas é obrigatória e nenhuma tranca a outra: dá para ter as três ligadas ao mesmo
          tempo e decidir, em cada modelo, de qual bolso sai.
        </p>

        <div className="mt-14 grid gap-px lg:grid-cols-3" style={{ background: 'var(--hairline)' }}>
          {VIAS.map((via) => (
            <div
              key={via.titulo}
              className="flex flex-col gap-4 p-7 sm:p-8"
              style={{ background: 'var(--surface, transparent)' }}
            >
              <div className="flex items-baseline gap-2">
                <h3 className="text-[19px] font-medium">{via.titulo}</h3>
                {via.selo && (
                  <span
                    className="gb-mono rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-wide"
                    style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-muted)' }}
                  >
                    {via.selo}
                  </span>
                )}
              </div>

              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {via.resumo}
              </p>

              <ul className="mt-1 flex flex-col gap-2.5">
                {via.itens.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed">
                    <span
                      className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: 'var(--accent)' }}
                      aria-hidden
                    />
                    <span style={{ color: 'var(--ink-muted)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
          Anthropic com chave própria: em breve.
        </p>
      </div>
    </section>
  )
}
