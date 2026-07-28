import type { Metadata } from 'next'
import { ContentPage, Secao, SubSecao, Lista, Tabela, Indice, A } from '@/components/site/ContentPage'
import { EMPRESA } from '@/lib/empresa'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Axyoma',
  description:
    'Como o Axyoma AI trata dados pessoais: o que coletamos, com quem compartilhamos, por quanto tempo guardamos e o que acontece com o conteúdo que você envia. Em conformidade com a LGPD (Lei 13.709/2018).',
}

// =============================================================================
// POLÍTICA DE PRIVACIDADE
//
// REGRA QUE GOVERNA ESTE ARQUIVO: aqui só entra afirmação verificável no código
// ou no banco. Numa auditoria, política que promete mais do que o sistema faz é
// pior do que política curta — vira passivo, não ativo. Toda seção abaixo foi
// escrita depois de conferir a fonte, e os apontamentos ficam registrados para
// quem for revisar no futuro:
//
//   • proxy não persiste conteúdo → `app/api/v1/chat/completions/route.ts`
//     só tem `console.error` de falha, sempre por `scrubSecret`. Não há INSERT
//     com corpo de mensagem em lugar nenhum da rota.
//   • `usage_log.meta` só carrega contabilidade → auditado nas 3.162 linhas
//     existentes: cost_usd, cost_brl, charged_brl, usd_brl_rate, margin_*,
//     hold_*. Nenhuma chave de conteúdo.
//   • `client_events` não tem coluna de conteúdo por construção → ver o
//     cabeçalho de `supabase/migrations/20260727_client_events.sql`.
//   • conversas ficam locais → `src/main/ipc/conversations.ts` grava em
//     `userData/conversations.json`; planos, artefatos e checkpoints idem.
//   • CPF vive em `asaas_customers.cpf_cnpj`. As colunas `profiles.tax_id` e
//     `profiles.phone` EXISTEM mas nunca foram preenchidas — por isso não são
//     declaradas como coletadas. Se algum dia forem usadas, esta seção muda.
//   • cookie próprio: só `axyoma-access-token` (`lib/conta-context.tsx:43`).
//     O servidor nunca emite Set-Cookie; conferido em produção.
//   • nenhuma biblioteca de analytics no `package.json`.
//
// PRAZOS DE RETENÇÃO são decisão do controlador, não dedução do código. Os
// números abaixo foram definidos pelo dono em 28/07/2026.
//
// PENDENTE DE REVISÃO JURÍDICA antes de uso em edital ou contrato corporativo.
// =============================================================================

const ATUALIZADO = '28 de julho de 2026'

const SECOES = [
  { id: 'escopo', titulo: 'Escopo e a quem se aplica' },
  { id: 'controlador', titulo: 'Controlador e Encarregado' },
  { id: 'dados', titulo: 'Dados que tratamos' },
  { id: 'conteudo', titulo: 'O conteúdo que você envia' },
  { id: 'chaves', titulo: 'Chaves de API (BYOK)' },
  { id: 'bases', titulo: 'Bases legais' },
  { id: 'operadores', titulo: 'Com quem compartilhamos' },
  { id: 'internacional', titulo: 'Transferência internacional' },
  { id: 'retencao', titulo: 'Por quanto tempo guardamos' },
  { id: 'seguranca', titulo: 'Segurança' },
  { id: 'cookies', titulo: 'Cookies e armazenamento local' },
  { id: 'direitos', titulo: 'Seus direitos' },
  { id: 'menores', titulo: 'Menores de idade' },
  { id: 'incidentes', titulo: 'Incidentes de segurança' },
  { id: 'alteracoes', titulo: 'Alterações desta política' },
  { id: 'contato', titulo: 'Contato' },
]

export default function PrivacidadePage(): React.JSX.Element {
  return (
    <ContentPage
      title="Política de Privacidade"
      intro={`Última atualização: ${ATUALIZADO}. Esta política descreve como o ${EMPRESA.produto} coleta, utiliza, compartilha, armazena e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).`}
    >
      <Indice itens={SECOES} />

      <Secao id="escopo" titulo="1. Escopo e a quem se aplica">
        <p>
          Esta política vale para o aplicativo de desktop {EMPRESA.produto}, para o site{' '}
          {EMPRESA.dominio} e para os serviços de conta, créditos e execução de modelos que os
          acompanham. Ela se aplica a você que cria uma conta, baixa o aplicativo ou usa qualquer
          uma dessas funções.
        </p>
        <p>
          O {EMPRESA.produto} é um aplicativo que roda <strong>na sua máquina</strong>. Boa parte do
          que você produz nele — conversas, planos, arquivos e histórico — nunca chega aos nossos
          servidores. Esta política diz, ponto a ponto, o que chega e o que não chega.
        </p>
      </Secao>

      <Secao id="controlador" titulo="2. Controlador e Encarregado">
        <SubSecao titulo="Controlador dos dados pessoais">
          <p>
            {EMPRESA.razaoSocial}, inscrita no CNPJ nº {EMPRESA.cnpj}, com sede em {EMPRESA.cidade},
            é a controladora responsável pelas decisões sobre o tratamento dos dados pessoais
            descritos nesta política, nos termos do art. 5º, VI, da LGPD.
          </p>
        </SubSecao>
        <SubSecao titulo="Encarregado pelo tratamento de dados (DPO)">
          <p>
            Para exercer direitos, tirar dúvidas sobre esta política ou comunicar um problema de
            privacidade, o canal do Encarregado é{' '}
            <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A> (art. 41 da LGPD).
          </p>
        </SubSecao>
      </Secao>

      <Secao id="dados" titulo="3. Dados que tratamos">
        <SubSecao titulo="3.1. Cadastro e conta">
          <Lista
            itens={[
              'Nome e endereço de e-mail, informados por você ou fornecidos pelo Google quando o acesso é feito por conta Google.',
              'Foto de perfil, quando fornecida pelo provedor de login.',
              'Preferências do aplicativo que você escolhe salvar na conta.',
            ]}
          />
        </SubSecao>

        <SubSecao titulo="3.2. Autenticação e sessão">
          <p>
            Tokens de acesso e atualização emitidos no login, usados para manter você conectado e
            para autorizar cada requisição. O acesso é feito por e-mail e senha ou por conta Google
            (OAuth). A senha, quando existe, é tratada exclusivamente pelo serviço de autenticação
            do Supabase e nunca é armazenada por nós em texto legível.
          </p>
        </SubSecao>

        <SubSecao titulo="3.3. Cobrança e pagamento">
          <Lista
            itens={[
              'CPF ou CNPJ, informado na primeira compra de créditos. Ele é enviado ao gateway de pagamento para criar o seu cadastro de pagador e guardado por nós apenas para reaproveitar esse cadastro nas compras seguintes.',
              'Identificador do seu cadastro no gateway, histórico de compras, valores e situação de cada cobrança.',
              'Saldo de créditos, bônus de cadastro e franquias de plano.',
            ]}
          />
          <p>
            <strong style={{ color: 'var(--ink)' }}>Não recebemos dados de cartão.</strong> Os
            pagamentos são processados diretamente pelo gateway, em ambiente dele.
          </p>
        </SubSecao>

        <SubSecao titulo="3.4. Uso e consumo">
          <p>
            Para cada execução paga com créditos Axyoma, registramos data e hora, o modelo
            utilizado, a quantidade de tokens de entrada e de saída e o valor debitado, com a
            cotação e a margem aplicadas no momento. É o que permite mostrar o custo real de cada
            execução e sustentar a conferência do seu extrato.
          </p>
          <p>
            Este registro contém <strong style={{ color: 'var(--ink)' }}>números e identificadores
            de modelo — nunca o texto da sua solicitação nem a resposta</strong>.
          </p>
        </SubSecao>

        <SubSecao titulo="3.5. Telemetria de execução">
          <p>
            O aplicativo envia indicadores técnicos sobre como as execuções se comportam: contagem
            de tokens, tempo até a primeira resposta, duração total, número de iterações, se a
            execução terminou bem ou com erro, e o tipo do erro em categoria (por exemplo,
            &ldquo;limite de taxa&rdquo; ou &ldquo;falha de rede&rdquo;). Também registramos a
            versão do aplicativo, o sistema operacional e o modo em uso.
          </p>
          <p>Esta telemetria foi desenhada para não conseguir carregar o seu conteúdo:</p>
          <Lista
            itens={[
              'Das ferramentas usadas, guardamos apenas o NOME (por exemplo, “ler arquivo”) — nunca o argumento, que carregaria caminho ou conteúdo.',
              'O tamanho do contexto vai em faixa (“32–128k”), nunca no valor exato, que é assinatura do projeto.',
              'O projeto é identificado por um número aleatório gerado na sua máquina, jamais derivado do nome ou do caminho da pasta.',
              'A mensagem de erro do provedor nunca é gravada, apenas a categoria — a mensagem original pode conter trechos do que você escreveu.',
            ]}
          />
        </SubSecao>

        <SubSecao titulo="3.6. Dados que ficam apenas na sua máquina">
          <p>
            Não são transmitidos a nós e não temos acesso a eles:
          </p>
          <Lista
            itens={[
              'O histórico de conversas com o agente.',
              'Planos, artefatos e pontos de restauração gerados nos modos Plan e Code.',
              'Os arquivos e o código dos seus projetos.',
              'As suas chaves de API (ver a seção 5).',
            ]}
          />
        </SubSecao>
      </Secao>

      <Secao id="conteudo" titulo="4. O conteúdo que você envia">
        <p>
          Esta é a seção mais importante para quem avalia uma ferramenta de IA, então ela é
          específica. &ldquo;Conteúdo&rdquo; aqui significa tudo que você escreve para o agente e
          tudo que ele lê a seu pedido: instruções, trechos de código, arquivos, imagens e
          documentos.
        </p>
        <p>
          O que acontece com esse conteúdo <strong style={{ color: 'var(--ink)' }}>depende de qual
          das três formas de execução você escolheu</strong>, modelo a modelo, dentro do aplicativo:
        </p>

        <Tabela
          colunas={['Forma de execução', 'Por onde o conteúdo passa', 'Nós armazenamos?']}
          linhas={[
            [
              <strong key="a" style={{ color: 'var(--ink)' }}>Créditos Axyoma</strong>,
              'Da sua máquina ao nosso servidor, que encaminha ao provedor do modelo e devolve a resposta.',
              'Não. O conteúdo trafega, é encaminhado e descartado.',
            ],
            [
              <strong key="b" style={{ color: 'var(--ink)' }}>Sua própria chave (BYOK)</strong>,
              'Da sua máquina direto ao provedor. Não passa por nós.',
              'Não. Não temos como: não passa por nós.',
            ],
            [
              <strong key="c" style={{ color: 'var(--ink)' }}>Modelo local</strong>,
              'Não sai da sua máquina.',
              'Não. Não há transmissão alguma.',
            ],
          ]}
        />

        <SubSecao titulo="4.1. Não guardamos o conteúdo das solicitações">
          <p>
            No caminho por créditos Axyoma, o nosso servidor funciona como intermediário: recebe a
            solicitação, autoriza, encaminha ao provedor, transmite a resposta de volta e registra
            apenas o consumo em tokens para o débito. Não há gravação do texto enviado nem do texto
            recebido — nem em banco, nem em arquivo, nem em log. Quando ocorre uma falha, gravamos
            somente a mensagem técnica do erro, e ela passa por uma rotina de remoção de segredos
            antes de ser registrada.
          </p>
        </SubSecao>

        <SubSecao titulo="4.2. Não treinamos modelos com o seu conteúdo">
          <p>
            Não usamos, e não temos programa para usar, o conteúdo enviado por usuários para treinar,
            ajustar ou avaliar modelos de inteligência artificial — próprios ou de terceiros. Se isso
            mudar, será por consentimento específico e informado, jamais por padrão.
          </p>
        </SubSecao>

        <SubSecao titulo="4.3. O que o provedor do modelo faz com o conteúdo">
          <p>
            Para executar a sua solicitação, o conteúdo precisa alcançar o provedor de IA que você
            escolheu. O que aquele provedor faz com o conteúdo é regido pela política dele, não por
            esta. Recomendamos a leitura das políticas dos provedores listados na seção 7 antes de
            enviar informação sensível ou sujeita a sigilo contratual.
          </p>
          <p>
            Se você não quiser que o conteúdo alcance terceiro algum, use um{' '}
            <strong style={{ color: 'var(--ink)' }}>modelo local</strong>: ele roda na sua máquina,
            sem rede, e está disponível no plano gratuito.
          </p>
        </SubSecao>
      </Secao>

      <Secao id="chaves" titulo="5. Chaves de API (BYOK)">
        <p>
          Quando você opta por usar a sua própria chave de API, ela é guardada{' '}
          <strong style={{ color: 'var(--ink)' }}>na sua máquina</strong>, cifrada pelo mecanismo de
          proteção de credenciais do seu sistema operacional, junto com as demais credenciais do
          aplicativo.
        </p>
        <Lista
          itens={[
            'A chave nunca é gravada nos nossos servidores — não fica em banco, log nem backup.',
            'Ela é usada exclusivamente para autenticar as solicitações que você mesmo dispara, em seu nome.',
            'Para removê-la, apague o campo em Configurações → Modelos: ela some do seu computador e não existe cópia em outro lugar.',
          ]}
        />
        <p>
          O consumo gerado por essa chave é cobrado pelo provedor diretamente de você, e não passa
          pelos créditos Axyoma.
        </p>
      </Secao>

      <Secao id="bases" titulo="6. Bases legais">
        <p>
          Todo tratamento descrito aqui se apoia em uma das hipóteses do art. 7º da LGPD:
        </p>
        <Tabela
          colunas={['Finalidade', 'Base legal']}
          linhas={[
            ['Criar e manter a sua conta; autenticar o acesso', 'Execução de contrato (art. 7º, V)'],
            ['Executar as funções do produto e encaminhar solicitações ao provedor escolhido', 'Execução de contrato (art. 7º, V)'],
            ['Processar compras de crédito e manter o seu cadastro de pagador', 'Execução de contrato (art. 7º, V)'],
            ['Guardar registros fiscais e contábeis das operações', 'Cumprimento de obrigação legal (art. 7º, II)'],
            ['Prevenir fraude, abuso e uso indevido do serviço', 'Legítimo interesse (art. 7º, IX)'],
            ['Medir desempenho e estabilidade por telemetria técnica', 'Legítimo interesse (art. 7º, IX)'],
            ['Prestar suporte quando você nos procura', 'Execução de contrato (art. 7º, V)'],
            ['Comunicações não essenciais, se houver', 'Consentimento (art. 7º, I), revogável a qualquer momento'],
          ]}
        />
        <p>
          Nos tratamentos apoiados em legítimo interesse, avaliamos que a finalidade é específica,
          o dado é o mínimo necessário e não há prevalência dos seus direitos e liberdades
          fundamentais — a telemetria, por exemplo, foi construída de modo a não conseguir carregar
          o seu conteúdo. Você pode se opor a esses tratamentos pelo canal da seção 16.
        </p>
      </Secao>

      <Secao id="operadores" titulo="7. Com quem compartilhamos">
        <p>
          Não vendemos dados pessoais e não os cedemos para publicidade. Compartilhamos apenas com
          os operadores necessários para o serviço funcionar, e somente na medida necessária:
        </p>
        <Tabela
          colunas={['Operador', 'Para quê', 'País']}
          linhas={[
            ['Supabase', 'Banco de dados, autenticação e armazenamento da conta', 'Estados Unidos'],
            ['Vercel', 'Hospedagem do site e do serviço que encaminha as execuções', 'Estados Unidos'],
            ['Google Cloud (Vertex AI)', 'Execução dos modelos pagos com créditos Axyoma', 'Estados Unidos'],
            ['Google (OAuth)', 'Login com conta Google, quando você escolhe essa opção', 'Estados Unidos'],
            ['OpenRouter', 'Execução de modelos, por crédito Axyoma ou por chave sua', 'Estados Unidos'],
            ['OpenAI', 'Execução de modelos com chave sua', 'Estados Unidos'],
            ['Tavily', 'Busca na web: recebe o termo pesquisado quando o agente usa essa ferramenta', 'Estados Unidos'],
            ['Asaas', 'Processamento de pagamentos e cadastro de pagador', 'Brasil'],
          ]}
        />
        <p>
          Também podemos compartilhar dados para cumprir ordem judicial ou requisição de autoridade
          competente, e para exercer ou defender direitos em processo — sempre no limite do que for
          exigido.
        </p>
        <p>
          Esta lista é mantida atualizada. Se um operador entrar ou sair, a alteração aparece aqui
          junto com a data de atualização no topo da página.
        </p>
      </Secao>

      <Secao id="internacional" titulo="8. Transferência internacional">
        <p>
          Como mostra a tabela acima, parte da infraestrutura fica fora do Brasil, principalmente
          nos Estados Unidos. Isso significa que dados pessoais podem ser transferidos e tratados
          no exterior, nos termos do capítulo V da LGPD.
        </p>
        <p>
          Essas transferências ocorrem para a execução do contrato firmado com você — sem elas o
          serviço não funciona — e se apoiam nas garantias contratuais oferecidas pelos operadores,
          incluindo cláusulas de proteção de dados e compromissos de segurança da informação.
        </p>
        <p>
          Se você precisa que nada saia do país nem da sua máquina, use{' '}
          <strong style={{ color: 'var(--ink)' }}>modelos locais</strong>, em que não há transmissão
          alguma de conteúdo.
        </p>
      </Secao>

      <Secao id="retencao" titulo="9. Por quanto tempo guardamos">
        <Tabela
          colunas={['Categoria', 'Prazo', 'Motivo']}
          linhas={[
            ['Cadastro e conta', 'Enquanto a conta existir', 'Necessário para prestar o serviço'],
            ['Registros de consumo, débito e compras', '5 anos após o fato', 'Prazo de guarda fiscal e contábil'],
            ['Cadastro de pagador (CPF/CNPJ)', '5 anos após a última operação', 'Prazo de guarda fiscal e contábil'],
            ['Telemetria de execução', '18 meses', 'Análise de desempenho e estabilidade'],
            ['Dados de conta excluída', 'Eliminados em até 30 dias', 'Janela para reversão de exclusão acidental'],
            ['Cópias de segurança', 'Até 7 dias', 'Retenção de backup da infraestrutura de banco'],
          ]}
        />
        <p>
          Passado o prazo de 30 dias da exclusão, os dados da conta são eliminados. Permanecem
          apenas os registros que a lei obriga a guardar — de cobrança e fiscais —, desvinculados do
          seu perfil sempre que a finalidade permitir.
        </p>
      </Secao>

      <Secao id="seguranca" titulo="10. Segurança">
        <p>
          Adotamos medidas técnicas e administrativas para proteger dados pessoais contra acesso não
          autorizado, perda, alteração e destruição. As principais:
        </p>
        <Lista
          itens={[
            'Criptografia em trânsito (TLS) em toda comunicação entre o aplicativo, o site e os nossos serviços.',
            'Isolamento por linha no banco de dados: cada usuário só alcança os próprios registros, com a regra aplicada pelo banco e não pela aplicação.',
            'Tabelas financeiras — saldo, reservas e razão de cobrança — sem qualquer permissão de escrita para o usuário; só o serviço autorizado escreve nelas.',
            'Autenticação por token assinado, revalidado no servidor a cada requisição sensível.',
            'Remoção automática de segredos das mensagens de erro antes de qualquer registro.',
            'Credenciais do usuário cifradas pelo mecanismo do sistema operacional, na máquina dele.',
            'Princípio do menor privilégio nos acessos administrativos à infraestrutura.',
          ]}
        />
        <p>
          Nenhuma medida elimina o risco por completo. Se identificar uma vulnerabilidade, escreva
          para <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A> — pedimos que a divulgação
          seja feita de forma responsável, dando-nos prazo para corrigir antes de publicá-la.
        </p>
      </Secao>

      <Secao id="cookies" titulo="11. Cookies e armazenamento local">
        <p>
          O site usa <strong style={{ color: 'var(--ink)' }}>apenas o estritamente necessário</strong>{' '}
          para manter você conectado. Não há cookie de publicidade, de rastreamento entre sites nem
          ferramenta de análise de audiência — não utilizamos Google Analytics ou equivalente.
        </p>
        <Tabela
          colunas={['Nome', 'Para quê', 'Duração']}
          linhas={[
            [
              <span key="c" className="gb-mono text-[13.5px]">axyoma-access-token</span>,
              'Espelho do token de sessão, para o servidor confirmar a sua identidade ao proteger as áreas restritas da conta.',
              '1 hora, renovado enquanto a sessão estiver ativa',
            ],
          ]}
        />
        <p>
          Além dele, a sua sessão é mantida no <strong style={{ color: 'var(--ink)' }}>armazenamento
          local do navegador</strong> pelo serviço de autenticação. Sair da conta remove os dois.
          Apagar os dados do site pelo navegador também.
        </p>
        <p>
          Por serem essenciais ao funcionamento, esses itens não dependem de consentimento prévio —
          sem eles não é possível manter o acesso à sua conta. Se essa situação mudar, um aviso de
          consentimento será apresentado antes.
        </p>
      </Secao>

      <Secao id="direitos" titulo="12. Seus direitos">
        <p>
          O art. 18 da LGPD garante a você, a qualquer momento e gratuitamente:
        </p>
        <Lista
          itens={[
            'Confirmação de que tratamos dados seus.',
            'Acesso aos dados que mantemos.',
            'Correção de dados incompletos, inexatos ou desatualizados.',
            'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei.',
            'Portabilidade a outro fornecedor, mediante requisição expressa.',
            'Eliminação dos dados tratados com base no seu consentimento.',
            'Informação sobre as entidades com as quais compartilhamos dados — a lista está na seção 7.',
            'Informação sobre a possibilidade de não consentir e as consequências disso.',
            'Revogação do consentimento.',
            'Oposição a tratamento apoiado em legítimo interesse.',
            'Revisão de decisão tomada unicamente por tratamento automatizado que afete seus interesses.',
          ]}
        />
        <p>
          Para exercer qualquer um deles, escreva para{' '}
          <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A>. Respondemos em até 15 dias.
          Podemos pedir informação adicional para confirmar a sua identidade antes de atender —
          é uma proteção contra pedido feito por terceiro em seu nome.
        </p>
        <p>
          Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao id="menores" titulo="13. Menores de idade">
        <p>
          O {EMPRESA.produto} destina-se a maiores de 18 anos. Não coletamos intencionalmente dados
          de crianças ou adolescentes. Se tomarmos conhecimento de conta criada por menor de 18
          anos, ela será encerrada e os dados eliminados. Responsáveis que identifiquem essa
          situação podem nos escrever pelo canal da seção 16 para que a remoção seja imediata.
        </p>
      </Secao>

      <Secao id="incidentes" titulo="14. Incidentes de segurança">
        <p>
          Se ocorrer incidente de segurança que possa acarretar risco ou dano relevante a você,
          comunicaremos a Autoridade Nacional de Proteção de Dados e você mesmo em{' '}
          <strong style={{ color: 'var(--ink)' }}>até 72 horas</strong> a contar do momento em que
          tomarmos conhecimento do fato, conforme o art. 48 da LGPD.
        </p>
        <p>A comunicação incluirá, no mínimo:</p>
        <Lista
          itens={[
            'A descrição da natureza dos dados pessoais afetados.',
            'As informações sobre os titulares envolvidos.',
            'As medidas técnicas e de segurança que estavam em uso.',
            'Os riscos relacionados ao incidente.',
            'Os motivos da demora, caso a comunicação não tenha sido imediata.',
            'As medidas que foram ou serão adotadas para reverter ou reduzir os efeitos.',
          ]}
        />
        <p>
          Mantemos registro interno dos incidentes e das medidas tomadas, disponível à autoridade
          quando requisitado.
        </p>
      </Secao>

      <Secao id="alteracoes" titulo="15. Alterações desta política">
        <p>
          Podemos atualizar esta política para refletir mudanças no produto, na infraestrutura ou na
          legislação. A data de última atualização fica sempre no topo da página. Mudanças
          relevantes — nova finalidade, novo operador, alteração de prazo de retenção — serão
          comunicadas por e-mail ou por aviso no aplicativo antes de entrarem em vigor.
        </p>
        <p>
          Versões anteriores podem ser solicitadas pelo canal abaixo.
        </p>
      </Secao>

      <Secao id="contato" titulo="16. Contato">
        <p>
          Encarregado pelo tratamento de dados pessoais (DPO):{' '}
          <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A>.
        </p>
        <p>
          {EMPRESA.razaoSocial} — CNPJ {EMPRESA.cnpj} — {EMPRESA.cidade}.
        </p>
      </Secao>
    </ContentPage>
  )
}
