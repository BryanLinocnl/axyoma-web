const ITEMS: Array<[string, string]> = [
  [
    'O que é o Axyoma AI?',
    'Um app de desktop (macOS, Windows e Linux) com três modos de trabalho: Code, onde um agente lê, escreve e edita o seu projeto, roda comandos e abre o PR no GitHub; Plan, onde a feature vira uma lista de tarefas que você aprova antes de qualquer execução; e Design, onde a IA cria artes para as suas redes.',
  ],
  [
    'Como funcionam os créditos?',
    'Não existe chave de API: você usa créditos Axyoma, e 1 crédito custa R$ 0,30. Cada chamada debita pelo custo real do modelo que rodou — modelo barato para tarefa simples custa barato. Toda conta nova ganha 400 créditos de bônus. Bônus e franquia valem para os modelos da Vertex AI; créditos comprados valem para todos.',
  ],
  [
    'Quais modelos posso usar?',
    'Os principais, num seletor só: Gemini, Claude, GPT, Grok, Llama, DeepSeek, Kimi, Qwen, Mistral e outros. Dá para trocar de modelo no meio da conversa, sem sair do app e sem cadastrar nada.',
  ],
  [
    'Quais são os planos?',
    'Free está no ar: 400 créditos de bônus ao se cadastrar, e você compra mais quando quiser, sem assinar. Pro e Teams vêm em breve, com franquia mensal de créditos e o modo Design; os valores serão anunciados no lançamento.',
  ],
  [
    'Em quais sistemas roda?',
    'macOS (Apple Silicon e Intel), Windows e Linux. A atualização é automática no Windows e no Linux; no macOS o app avisa quando há versão nova.',
  ],
  [
    'Como eu pago?',
    'Por PIX ou cartão de crédito, no checkout do site ou dentro do próprio app.',
  ],
]

export function Faq(): React.JSX.Element {
  return (
    <section id="faq" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">Perguntas frequentes</h2>

        <div className="mt-12 flex flex-col gap-3">
          {ITEMS.map(([q, a]) => (
            // `name="faq"` = accordion nativo: abrir um fecha os outros, sem JS.
            <details
              key={q}
              name="faq"
              className="group rounded-[18px] px-5 py-4 transition-colors sm:px-6 sm:py-5"
              style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[16.5px] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[18px] leading-none transition-transform duration-200 group-open:rotate-45"
                  style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-muted)' }}
                >
                  +
                </span>
              </summary>
              <p
                className="mt-3 max-w-[68ch] text-[15px] leading-relaxed"
                style={{ color: 'var(--ink-muted)' }}
              >
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
