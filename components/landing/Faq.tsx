const ITEMS: Array<[string, string]> = [
  [
    'O que é o Axyoma AI?',
    'Um estúdio de engenharia com IA em app desktop (macOS, Windows e Linux). Num só app você cria artes para redes sociais (Design), planeja features em tarefas revisáveis (Plan) e roda um agente que lê, escreve e edita código, executa comandos e entrega até o PR no GitHub (Code).',
  ],
  [
    'Como funcionam os créditos?',
    'Sem chave de API: você usa créditos Axyoma (1 crédito = R$ 0,30), debitados pelo custo real do modelo. Toda conta nova ganha 400 créditos de bônus — um mês de Pro para testar. Bônus e franquia valem para os modelos da Vertex AI; créditos comprados valem para todos.',
  ],
  [
    'Quais modelos posso usar?',
    'Os principais num seletor só: Gemini, Claude, GPT, Grok, Llama, DeepSeek e outros. Escolha o melhor por tarefa, sem trocar de app.',
  ],
  [
    'Quais são os planos?',
    'Free: 400 créditos de bônus ao se cadastrar — equivalente a um mês do plano Pro para testar. Pro e Teams (em breve): planos pagos com créditos de franquia e o modo Design. Os valores serão anunciados no lançamento. Bônus e franquia valem para os modelos da Vertex AI; créditos comprados valem para todos os modelos.',
  ],
  [
    'Em quais sistemas roda?',
    'macOS (Apple Silicon e Intel), Windows e Linux. Atualização automática no Windows e Linux; no macOS o app avisa quando há nova versão.',
  ],
  [
    'Como pago?',
    'Por PIX ou cartão de crédito, no checkout do site ou do app.',
  ],
]

export function Faq(): React.JSX.Element {
  return (
    <section id="faq" className="relative border-t border-white/8 bg-[#030304]">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Perguntas frequentes
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tudo o que você precisa saber
          </h2>
        </div>

        <div className="mt-12 flex flex-col gap-3">
          {ITEMS.map(([q, a]) => (
            // name="faq" => grupo exclusivo nativo: abrir um fecha os demais (accordion).
            <details
              key={q}
              name="faq"
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors open:border-white/20 hover:border-white/20 sm:p-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-2xl font-light leading-none text-[var(--brand-2)] transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-dim)]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
