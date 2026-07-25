const ITEMS: Array<[string, string]> = [
  [
    'O que é o Axyoma?',
    'O Axyoma é uma plataforma para criar, revisar e executar tarefas com IA utilizando diversos modelos em um único aplicativo. Roda como app de desktop, ao lado do seu editor e do seu terminal.',
  ],
  [
    'Preciso configurar APIs?',
    'Não para começar. Basta criar sua conta e utilizar os créditos disponíveis.',
  ],
  [
    'Posso escolher qual modelo usar?',
    'Sim. Você pode selecionar o modelo mais adequado para cada tarefa conforme custo, velocidade ou qualidade — Gemini, Claude, GPT, Grok, Llama, DeepSeek, Kimi, Qwen, Mistral e outros, num seletor só.',
  ],
  [
    'O agente pode executar comandos sozinho?',
    'Somente quando você permitir. Ações importantes sempre podem exigir aprovação antes da execução.',
  ],
  [
    'Como funciona a cobrança?',
    'Você acompanha o consumo em créditos durante toda a execução. O custo é transparente e aparece antes da confirmação das tarefas. Um crédito custa R$ 0,30 e você paga por PIX ou cartão. Bônus e franquia valem para os modelos da Vertex AI; créditos comprados valem para todos os modelos.',
  ],
  [
    'Quais sistemas operacionais são suportados?',
    'Windows, macOS (Apple Silicon e Intel) e Linux. A atualização é automática no Windows e no Linux; no macOS o app avisa quando há versão nova.',
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
