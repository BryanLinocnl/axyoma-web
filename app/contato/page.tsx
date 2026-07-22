import type { Metadata } from 'next'
import { ContentPage, Secao, Card, A } from '@/components/site/ContentPage'
import { EMPRESA } from '@/lib/empresa'

export const metadata: Metadata = {
  title: 'Sobre e Contato — Axyoma',
  description:
    'O que é o Axyoma AI, como funciona o modelo de créditos, planos, plataformas suportadas e como falar com a equipe.',
}

const FAQ: Array<[string, string]> = [
  [
    'O que é o Axyoma AI?',
    'Um estúdio de engenharia com IA em app desktop (macOS, Windows e Linux). Em um só app você cria artes para redes sociais (modo Design), planeja features em tarefas revisáveis (modo Plan) e roda um agente que lê, escreve e edita código, executa comandos e entrega até o PR no GitHub (modo Code).',
  ],
  [
    'Como funcionam os créditos?',
    'Você não precisa de chave de API própria. Usa créditos Axyoma, onde 1 crédito = R$ 0,30, e o débito é calculado pelo custo real (em USD) do modelo escolhido. Toda conta nova recebe 400 créditos de bônus — na prática, um mês do plano Pro grátis para testar. Os créditos de bônus e os de franquia dos planos (Pro e Teams) valem para os modelos da Vertex AI (Google Cloud); os créditos comprados valem para todos os modelos, incluindo os da Vertex.',
  ],
  [
    'Quais modelos de IA posso usar?',
    'Um catálogo com os principais modelos do mercado em um seletor só — Gemini, Claude, GPT, Grok, Llama, DeepSeek, Kimi e outros. Os modelos do Google (Vertex AI) são acessados com os créditos de bônus e de franquia; para os demais modelos, use créditos comprados (que valem para todos).',
  ],
  [
    'Quais são os planos?',
    'Free: 400 créditos de bônus ao se cadastrar, equivalente a um mês do plano Pro para testar. Pro e Teams (em breve): planos pagos com créditos de franquia e o modo Design; os valores serão anunciados no lançamento. Bônus e franquia valem para os modelos da Vertex AI; créditos comprados valem para todos os modelos.',
  ],
  [
    'Em quais sistemas roda?',
    'macOS (Apple Silicon e Intel), Windows e Linux. O app se mantém atualizado automaticamente no Windows e Linux; no macOS notifica quando há nova versão.',
  ],
  [
    'Como pago?',
    'Por PIX ou cartão de crédito, no checkout do site ou do app.',
  ],
]

export default function ContatoPage(): React.JSX.Element {
  return (
    <ContentPage
      title="Sobre e Contato"
      intro="O que é o Axyoma, como funciona e como falar com a gente."
    >
      <Secao titulo="Sobre o Axyoma">
        <p>
          O {EMPRESA.produto} é um estúdio de engenharia com IA para desenvolvedores, makers, agências e
          freelancers. Em vez de só sugerir, o agente executa: lê e escreve arquivos, roda testes, lint,
          build e migrações, depura lendo logs e entrega o resultado — com terminal integrado, editor de
          código e integração com o GitHub. Tudo com um modelo de créditos que você controla, sem montar
          infraestrutura e sem gerenciar chaves de API.
        </p>
        <p>
          Quer o detalhe de tudo o que ele faz? Veja a página de <A href="/recursos">Recursos</A>.
        </p>
        <p>
          Operado por {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}, {EMPRESA.cidade}.
        </p>
      </Secao>

      <Secao titulo="Fale com a gente">
        <p>
          Suporte, dúvidas comerciais e imprensa: <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A>.
        </p>
      </Secao>

      <Secao titulo="Perguntas frequentes">
        {FAQ.map(([q, a]) => (
          <Card key={q}>
            <p className="text-lg font-semibold text-neutral-900">{q}</p>
            <p className="mt-2 text-neutral-600">{a}</p>
          </Card>
        ))}
      </Secao>
    </ContentPage>
  )
}
