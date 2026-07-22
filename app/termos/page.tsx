import type { Metadata } from 'next'
import { ContentPage, Secao } from '@/components/site/ContentPage'
import { EMPRESA } from '@/lib/empresa'

export const metadata: Metadata = {
  title: 'Termos de Uso — Axyoma',
  description: 'Termos e condições de uso do Axyoma AI: contas, créditos, pagamento e responsabilidades.',
}

// NOTA: texto-base. Recomenda-se revisão jurídica antes de considerar definitivo.
export default function TermosPage(): React.JSX.Element {
  return (
    <ContentPage
      title="Termos de Uso"
      intro="Última atualização: 22 de julho de 2026. Ao criar uma conta ou usar o Axyoma, você concorda com estes termos."
    >
      <Secao titulo="O serviço">
        <p>
          O {EMPRESA.produto} é um estúdio de engenharia com IA (app desktop para macOS, Windows e
          Linux) que permite desenhar artes, planejar features e executar código usando modelos de
          linguagem de terceiros, por meio de um sistema de créditos. O serviço é operado por{' '}
          {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}.
        </p>
      </Secao>

      <Secao titulo="Conta">
        <p>
          Você é responsável por manter a confidencialidade das suas credenciais e por toda atividade
          na sua conta. Deve fornecer dados verdadeiros e ter capacidade legal para contratar.
        </p>
      </Secao>

      <Secao titulo="Créditos e pagamento">
        <p>
          O uso é debitado em créditos calculados pelo custo real do modelo utilizado (1 crédito = R$
          0,30). Contas novas recebem 400 créditos de bônus. Os créditos de bônus e os créditos de
          franquia dos planos (Pro e Teams) são válidos exclusivamente para os modelos da Vertex AI
          (Google Cloud); os créditos comprados são válidos para todos os modelos, inclusive os da
          Vertex. Créditos comprados não são reembolsáveis após o consumo. Pagamentos são feitos via PIX
          e cartão de crédito. Planos e preços podem ser alterados mediante aviso.
        </p>
      </Secao>

      <Secao titulo="Uso aceitável">
        <p>
          Você não pode usar o Axyoma para atividades ilegais, para gerar conteúdo que viole direitos de
          terceiros, ou de forma que comprometa a segurança ou disponibilidade do serviço. Podemos
          suspender contas que violem estes termos.
        </p>
      </Secao>

      <Secao titulo="Propriedade e conteúdo">
        <p>
          Você mantém a titularidade do conteúdo que cria com a ferramenta. A marca, o software e a
          plataforma Axyoma permanecem de nossa propriedade. O conteúdo gerado por IA é fornecido
          {' '}&ldquo;como está&rdquo; — cabe a você revisar antes de usar em produção.
        </p>
      </Secao>

      <Secao titulo="Limitação de responsabilidade">
        <p>
          O serviço é fornecido &ldquo;no estado em que se encontra&rdquo;. Não garantimos que o resultado gerado por
          IA seja livre de erros. Na máxima extensão permitida em lei, nossa responsabilidade se limita
          ao valor pago nos 12 meses anteriores ao evento.
        </p>
      </Secao>

      <Secao titulo="Encerramento e foro">
        <p>
          Você pode encerrar sua conta a qualquer momento. Estes termos são regidos pelas leis do Brasil.
          Dúvidas:{' '}
          <a href={`mailto:${EMPRESA.email}`} className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700">
            {EMPRESA.email}
          </a>
          .
        </p>
      </Secao>
    </ContentPage>
  )
}
