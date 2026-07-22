import type { Metadata } from 'next'
import { ContentPage, Secao, Card, A } from '@/components/site/ContentPage'

export const metadata: Metadata = {
  title: 'Recursos — Axyoma',
  description:
    'Tudo o que o Axyoma AI faz: os três modos (Design, Plan e Code), o agente e suas ferramentas, catálogo multi-modelo, créditos, skills, integração com GitHub e suporte multiplataforma.',
}

const MODOS: Array<[string, string]> = [
  [
    'Design',
    'Criação de artes para redes sociais — posts, carrosséis, motions e templates. Você descreve a ideia, a IA desenha, você ajusta o resultado e publica. É a forma mais rápida de sair do briefing para a arte pronta sem abrir um editor à parte. O modo Design é exclusivo dos planos pagos.',
  ],
  [
    'Plan',
    'Planejamento antes de codar. Em vez de soltar um agente que faz tudo de uma vez, o Axyoma quebra a feature em tarefas, monta um plano que você lê e revisa, e só executa depois da sua aprovação. Você mantém o controle passo a passo e enxerga exatamente o que vai acontecer antes que aconteça.',
  ],
  [
    'Code',
    'Um agente de codificação que executa de ponta a ponta. Ele lê, escreve e edita arquivos de qualquer linguagem ou framework, roda comandos (testes, lint, build, migrações), depura lendo os próprios logs e entrega o trabalho — até abrir o pull request no GitHub. Vem com terminal integrado, editor Monaco e uma timeline visual de cada ação que o agente toma, para você acompanhar tudo em tempo real.',
  ],
]

const FERRAMENTAS: Array<[string, string]> = [
  ['Arquivos', 'Lê, escreve e edita arquivos do seu projeto, em qualquer linguagem ou framework.'],
  ['Comandos', 'Roda testes, lint, build, migrações e qualquer comando do terminal — e lê a saída para se corrigir.'],
  ['Depuração', 'Investiga erros lendo os logs e ajusta o código até funcionar.'],
  ['Busca web', 'Consulta a web quando precisa de contexto, documentação ou referência atualizada.'],
  ['Screenshot', 'Captura a tela para inspecionar interfaces e resultados visuais.'],
  ['Sub-agentes', 'Delega partes da tarefa a outros modelos — ou coloca vários para competir na melhor solução.'],
  ['Skills', 'Executa comandos e instruções reutilizáveis que você mesmo cria.'],
]

const VANTAGENS: Array<[string, string]> = [
  ['Sem gerenciar chaves de API', 'Você cria a conta, ganha créditos e usa. Nada de configurar provedores ou colar chaves.'],
  ['Só paga o que usa', 'O débito é por consumo real do modelo. Sem assinatura obrigatória para começar.'],
  ['Todos os modelos num lugar', 'Troque de modelo por tarefa sem trocar de aplicativo.'],
  ['Agente que executa', 'Do plano ao PR, o trabalho acontece dentro do app.'],
  ['Controle de verdade', 'O modo Plan revisa antes de agir: nada roda sem a sua aprovação.'],
  ['Multiplataforma e atualizado', 'macOS, Windows e Linux, com atualização automática.'],
]

export default function RecursosPage(): React.JSX.Element {
  return (
    <ContentPage
      title="Recursos"
      intro="O Axyoma AI é um estúdio de engenharia com IA em app desktop. Num só lugar você desenha, planeja e programa — com os melhores modelos e créditos que você controla. Veja em detalhe tudo o que ele faz."
    >
      <Secao titulo="Os três modos">
        <p>
          O produto gira em torno de três modos, trocados por um seletor no topo do app. Cada um resolve
          uma etapa diferente do seu trabalho.
        </p>
        {MODOS.map(([nome, desc]) => (
          <Card key={nome}>
            <p className="text-xl font-semibold text-neutral-900">{nome}</p>
            <p className="mt-2 text-neutral-600">{desc}</p>
          </Card>
        ))}
      </Secao>

      <Secao titulo="O agente e suas ferramentas">
        <p>
          No modo Code, o agente não apenas sugere — ele age. Para isso, tem um conjunto de ferramentas
          que operam diretamente no seu projeto:
        </p>
        <div className="flex flex-col gap-3">
          {FERRAMENTAS.map(([nome, desc]) => (
            <Card key={nome}>
              <p className="text-lg font-semibold text-neutral-900">{nome}</p>
              <p className="mt-1 text-neutral-600">{desc}</p>
            </Card>
          ))}
        </div>
      </Secao>

      <Secao titulo="Todos os modelos num lugar">
        <p>
          O Axyoma reúne os principais modelos do mundo num único seletor — Gemini, Claude, GPT, Grok,
          Llama, DeepSeek, Kimi e outros. Você escolhe o melhor modelo para cada tarefa sem sair do app e
          sem gerenciar chaves de API de cada provedor. Precisa de raciocínio pesado numa etapa e
          velocidade em outra? Basta trocar o modelo no seletor.
        </p>
      </Secao>

      <Secao titulo="Créditos que você controla">
        <p>
          Você não precisa de chave de API própria: usa créditos Axyoma. Cada crédito equivale a R$ 0,30
          e o débito é calculado pelo custo real (em dólar) do modelo que você escolheu — você paga pelo
          que consome, sem teto artificial e sem surpresa.
        </p>
        <p>
          Toda conta nova ganha <strong className="text-neutral-900">400 créditos de bônus</strong> ao se
          cadastrar — na prática, um mês do plano Pro para testar a plataforma à vontade. Quando os
          créditos acabam, você compra mais ou assina um plano.
        </p>
        <p>
          Uma regra importante: os créditos de bônus e os créditos de franquia dos planos (Pro e Teams)
          valem para os modelos da <strong className="text-neutral-900">Vertex AI (Google Cloud)</strong>.
          Já os créditos comprados valem para <strong className="text-neutral-900">todos os modelos</strong>,
          incluindo os da Vertex. Assim você testa sem custo e desbloqueia todo o catálogo quando quiser.
        </p>
      </Secao>

      <Secao titulo="Skills">
        <p>
          Skills são comandos e instruções reutilizáveis que você cria uma vez e chama sempre que
          precisar. Padronize um fluxo de revisão, um formato de commit, um estilo de resposta — e deixe
          o agente repetir isso do seu jeito, sem você reescrever a instrução toda vez.
        </p>
      </Secao>

      <Secao titulo="Integração com o GitHub">
        <p>
          O Axyoma se conecta ao GitHub para fechar o ciclo do trabalho: o agente cria e atualiza pull
          requests e exporta o projeto direto do app. Você sai do planejamento e chega ao PR sem trocar
          de ferramenta.
        </p>
      </Secao>

      <Secao titulo="Multiplataforma e sempre atualizado">
        <p>
          O app roda em macOS (Apple Silicon e Intel), Windows e Linux. No Windows e no Linux ele se
          atualiza sozinho; no macOS, avisa quando há uma nova versão para você baixar. Você trabalha
          sempre na versão mais recente sem esforço.
        </p>
      </Secao>

      <Secao titulo="Por que o Axyoma">
        <div className="flex flex-col gap-3">
          {VANTAGENS.map(([nome, desc]) => (
            <Card key={nome}>
              <p className="text-lg font-semibold text-neutral-900">{nome}</p>
              <p className="mt-1 text-neutral-600">{desc}</p>
            </Card>
          ))}
        </div>
        <p>
          Pronto para experimentar? <A href="/download">Baixe o app</A> e ganhe 400 créditos para começar,
          ou veja o <A href="/docs">guia rápido</A>.
        </p>
      </Secao>
    </ContentPage>
  )
}
