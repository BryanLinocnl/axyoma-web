/**
 * A virada da página: o problema, antes das funcionalidades.
 *
 * A landing ia do herói direto para recurso — modos, controle, custo, planos.
 * Quem chega sem conhecer o produto lia uma lista de coisas que ele faz sem
 * nunca ler por que elas importam. Esta seção é o degrau que faltava.
 *
 * POR QUE ESTE PROBLEMA, E NÃO "O MODELO MUDA TODO MÊS". A tentação é vender
 * independência de modelo — "troque de modelo, não de ferramenta". É a frase
 * mais repetida da categoria: Cline, Roo, Continue, Aider e o próprio OpenRouter
 * dizem exatamente isso. Copy que o concorrente também assina não diferencia
 * nada.
 *
 * O que um concorrente dono da própria infraestrutura NÃO consegue assinar são
 * as duas afirmações abaixo, e por motivo estrutural, não por escolha: o negócio
 * dele depende de o tráfego passar por lá. Daí serem estas as escolhidas.
 *
 * As duas são verificáveis, não adjetivo:
 *   • com chave própria o turno sai da máquina direto ao fornecedor — dá para
 *     conferir no tráfego (spec `proxy-direto-provider.md`);
 *   • modelo local pelo Ollama não sai da máquina, e está no plano gratuito.
 *
 * Aqui só se afirma. A prova vem depois, em `LedgerSection` (custo por chamada)
 * e `RunSection` (as três formas de rodar) — por isso o texto é curto e não
 * repete o que aquelas seções detalham.
 */

const ESCOLHAS: { titulo: string; corpo: string }[] = [
  {
    titulo: 'Onde o seu trabalho roda',
    corpo:
      'Com chave própria, o turno vai da sua máquina direto ao fornecedor. Com modelo local, não sai da máquina — e isso está no plano gratuito. Nos dois casos, o que você escreve não passa pelos nossos servidores.',
  },
  {
    titulo: 'Quanto custa, antes de rodar',
    corpo:
      'Você vê qual modelo vai executar e quanto aquela execução consome antes de confirmar. O débito aparece na hora, ligado ao modelo que rodou — e crédito comprado não expira.',
  },
]

export function ProblemSection(): React.JSX.Element {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">
          <span className="block">O que você escreve sai da sua máquina.</span>
          <span className="block" style={{ color: 'var(--ink-faint)' }}>
            E o preço, você descobre depois.
          </span>
        </h2>

        <p
          className="gb-measure mt-6 text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          É o que acontece quando a ferramenta é dona da infraestrutura: seu código vai para o
          servidor de quem vendeu o editor, e o custo vem embrulhado numa assinatura que não conta
          qual execução gastou o quê.
        </p>

        <div className="mt-14 border-t pt-12" style={{ borderColor: 'var(--hairline)' }}>
          <p className="text-[19px] font-medium">No Axyoma, as duas coisas são decisão sua.</p>

          <div className="mt-9 grid gap-x-12 gap-y-9 md:grid-cols-2">
            {ESCOLHAS.map((e) => (
              <div key={e.titulo}>
                <h3 className="text-[16px] font-medium">{e.titulo}</h3>
                <p
                  className="mt-2 text-[15px] leading-relaxed"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {e.corpo}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
