import type { Metadata } from 'next'
import { ContentPage, Secao, Card, A } from '@/components/site/ContentPage'

export const metadata: Metadata = {
  title: 'Documentação — Axyoma',
  description:
    'Guia de uso do Axyoma AI: instalação por sistema, login, como escolher modelos, como usar os modos Design, Plan e Code, créditos e cobrança.',
}

const INSTALACAO: Array<[string, string]> = [
  ['macOS', 'Baixe o .dmg (Apple Silicon ou Intel) na página de download, arraste o Axyoma para a pasta Aplicativos e abra. Quando houver atualização, o app avisa para você baixar a nova versão.'],
  ['Windows', 'Baixe o instalador .exe, execute e siga o assistente. O app se atualiza sozinho em segundo plano.'],
  ['Linux', 'Baixe o AppImage (ou o pacote da sua distro), dê permissão de execução e abra. Atualização automática incluída.'],
]

const MODOS: Array<[string, string]> = [
  ['Design', 'Escolha o modo Design no seletor do topo, descreva a arte que quer (post, carrossel, motion ou template), gere, ajuste o resultado e exporte. Disponível nos planos pagos.'],
  ['Plan', 'No modo Plan, descreva a feature. O Axyoma quebra em tarefas e monta um plano. Revise, edite se quiser e aprove — só então a execução começa.'],
  ['Code', 'No modo Code, dê a tarefa ao agente. Ele lê e edita arquivos, roda comandos, depura e mostra cada ação na timeline. Use o terminal e o editor integrados para acompanhar e intervir quando quiser. Ao final, ele pode abrir o PR no GitHub.'],
]

export default function DocsPage(): React.JSX.Element {
  return (
    <ContentPage
      title="Documentação"
      intro="Guia rápido para instalar, entender e tirar o máximo do Axyoma AI. Para uma visão completa dos recursos, veja a página de Recursos."
    >
      <Secao titulo="Instalação">
        <p>
          Baixe o app na <A href="/download">página de download</A> — o botão detecta o seu sistema. Depois
          de instalar, faça login com a sua conta Axyoma (a mesma do site).
        </p>
        {INSTALACAO.map(([nome, desc]) => (
          <Card key={nome}>
            <p className="text-lg font-semibold text-neutral-900">{nome}</p>
            <p className="mt-1 text-neutral-600">{desc}</p>
          </Card>
        ))}
      </Secao>

      <Secao titulo="Login e conta">
        <p>
          Entre com e-mail e senha ou com sua conta Google ou Apple — o login do app é o mesmo do site. Se
          esquecer a senha, use a opção de recuperação na tela de entrada. A área da conta mostra seu
          plano, saldo de créditos e histórico de uso.
        </p>
      </Secao>

      <Secao titulo="Escolher o modelo">
        <p>
          Em Config → Modelos, adicione os modelos que quer ver no seletor do chat. Durante o trabalho,
          troque o modelo por tarefa direto no seletor do topo — sem reconfigurar nada e sem chave de API.
          O catálogo inclui Gemini, Claude, GPT, Grok, Llama, DeepSeek, Kimi e outros.
        </p>
      </Secao>

      <Secao titulo="Usando os três modos">
        {MODOS.map(([nome, desc]) => (
          <Card key={nome}>
            <p className="text-lg font-semibold text-neutral-900">{nome}</p>
            <p className="mt-1 text-neutral-600">{desc}</p>
          </Card>
        ))}
      </Secao>

      <Secao titulo="Créditos e cobrança">
        <p>
          O uso é debitado em créditos (1 crédito = R$ 0,30), calculados pelo custo real do modelo. Toda
          conta nova ganha 400 créditos de bônus — equivalente a um mês de Pro para testar.
        </p>
        <p>
          Os créditos de bônus e os de franquia dos planos valem para os modelos da Vertex AI (Google
          Cloud). Os créditos comprados valem para todos os modelos, incluindo os da Vertex. Para comprar,
          use a aba Conta (no app ou no site) e pague via PIX. Acompanhe quanto cada turno consumiu em
          Conta → Uso recente.
        </p>
      </Secao>

      <Secao titulo="Precisa de ajuda?">
        <p>
          Ficou com dúvida ou encontrou um problema? Fale com a gente pela página de{' '}
          <A href="/contato">contato</A>. Mais conteúdo de documentação em breve.
        </p>
      </Secao>
    </ContentPage>
  )
}
