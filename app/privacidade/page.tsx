import type { Metadata } from 'next'
import { ContentPage, Secao } from '@/components/site/ContentPage'
import { EMPRESA } from '@/lib/empresa'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Axyoma',
  description:
    'Como o Axyoma AI coleta, usa e protege seus dados pessoais, em conformidade com a LGPD (Lei 13.709/2018).',
}

// NOTA: texto-base de conformidade com a LGPD. Recomenda-se revisão jurídica
// antes de considerar definitivo.
export default function PrivacidadePage(): React.JSX.Element {
  return (
    <ContentPage
      title="Política de Privacidade"
      intro="Última atualização: 22 de julho de 2026. Esta política descreve como tratamos seus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018)."
    >
      <Secao titulo="Quem somos">
        <p>
          O {EMPRESA.produto} é operado por {EMPRESA.razaoSocial}, inscrita no CNPJ {EMPRESA.cnpj},
          com sede em {EMPRESA.cidade}. Para qualquer questão sobre privacidade, contate{' '}
          <a href={`mailto:${EMPRESA.email}`} className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700">
            {EMPRESA.email}
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="Dados que coletamos">
        <p>
          <strong className="text-neutral-900">Cadastro:</strong> nome e e-mail ao criar sua conta.
        </p>
        <p>
          <strong className="text-neutral-900">Uso e cobrança:</strong> registros de consumo de créditos,
          modelos utilizados e histórico de compras (processadas por provedores de pagamento).
        </p>
        <p>
          <strong className="text-neutral-900">Conteúdo enviado aos modelos:</strong> os textos, arquivos e
          comandos que você envia ao agente são transmitidos aos provedores de IA para gerar a resposta.
        </p>
        <p>
          <strong className="text-neutral-900">Técnicos:</strong> dados de sessão e segurança (tokens de
          autenticação) necessários para operar o serviço.
        </p>
      </Secao>

      <Secao titulo="Como usamos">
        <p>
          Para autenticar seu acesso, executar as funcionalidades do produto, calcular o débito de
          créditos pelo custo real de uso, prestar suporte, cumprir obrigações legais e prevenir fraude
          e abuso. Não vendemos seus dados pessoais.
        </p>
      </Secao>

      <Secao titulo="Compartilhamento com terceiros">
        <p>
          Compartilhamos dados apenas com operadores necessários à prestação do serviço: provedores de
          modelos de IA (para processar suas solicitações), processadores de pagamento (PIX e cartão),
          e provedores de infraestrutura em nuvem e autenticação. Cada um trata os dados conforme suas
          próprias políticas e apenas na medida necessária.
        </p>
      </Secao>

      <Secao titulo="Seus direitos (LGPD)">
        <p>
          Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados,
          bem como revogar consentimento, escrevendo para{' '}
          <a href={`mailto:${EMPRESA.email}`} className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700">
            {EMPRESA.email}
          </a>
          . Responderemos nos prazos previstos em lei.
        </p>
      </Secao>

      <Secao titulo="Retenção e segurança">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa e pelo período exigido por obrigações
          legais. Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
          criptografia em trânsito e controle de acesso.
        </p>
      </Secao>

      <Secao titulo="Alterações">
        <p>
          Podemos atualizar esta política. Mudanças relevantes serão comunicadas pelo site ou por e-mail.
        </p>
      </Secao>
    </ContentPage>
  )
}
