const ITEMS: Array<[string, string]> = [
  [
    'O que é o Axyoma?',
    'O Axyoma é uma plataforma aberta para trabalhar com agentes de IA utilizando centenas de modelos em um único aplicativo. Roda como app de desktop, ao lado do seu editor e do seu terminal.',
  ],
  [
    'Preciso configurar uma API?',
    'Não. Você pode começar imediatamente com os créditos inclusos. Se preferir, também pode conectar sua própria OpenRouter e outros provedores compatíveis.',
  ],
  [
    'Posso usar minha própria OpenRouter?',
    'Sim. Em Configurações → Modelos você cola a sua chave da OpenRouter e escolhe os modelos que quer usar com ela. O que roda por essa chave é cobrado pela OpenRouter, direto de você, e não consome crédito Axyoma.',
  ],
  // Onde a chave mora é a primeira pergunta de quem cola uma chave num app de
  // terceiro, e a resposta é um diferencial nosso — não guardamos. Vale a
  // pergunta explícita em vez de uma linha escondida no meio de outra resposta.
  [
    'Onde fica guardada a minha chave de API?',
    'Na sua máquina, cifrada, junto com as outras credenciais do app. Ela nunca é gravada nos nossos servidores: vai cifrada em cada requisição, é usada em memória para falar com o provedor e descartada em seguida — não fica em log, banco nem backup. Para remover, apague o campo em Configurações → Modelos; ela some do seu computador e não existe cópia em outro lugar.',
  ],
  [
    'Dá para rodar modelos na minha própria máquina?',
    'Sim, e sem custo. O Axyoma conversa com o Ollama: instale pelo próprio app, baixe o modelo que quiser da biblioteca e ele fica disponível no seletor como qualquer outro. Roda offline, não passa pelos nossos servidores e não gasta crédito. O app avisa quando um modelo não cabe na memória da sua máquina.',
  ],
  [
    'Posso escolher qual modelo será utilizado?',
    'Sim. Escolha manualmente o modelo ideal para cada tarefa ou alterne entre diferentes provedores conforme custo, velocidade ou qualidade — Gemini, Claude, GPT, Grok, Llama, DeepSeek, Kimi, Qwen, Mistral e outros.',
  ],
  [
    'O agente executa ações automaticamente?',
    'Você define o nível de autonomia. Sempre que necessário, o Axyoma solicita sua aprovação antes de executar ações importantes.',
  ],
  [
    'Como funciona a cobrança?',
    'Você pode utilizar os créditos do Axyoma, comprar créditos adicionais ou utilizar sua própria API. O custo de cada execução é exibido de forma transparente. Um crédito custa R$ 0,30 e você paga por PIX ou cartão. Bônus e franquia valem para os modelos da Vertex AI; créditos comprados valem para todos os modelos.',
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
