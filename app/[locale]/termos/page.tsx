import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { ContentPage, Secao, SubSecao, Lista, Indice, A } from '@/components/site/ContentPage'
import { EMPRESA } from '@/lib/empresa'
import { alternatesFor } from '@/i18n/alternates'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'Termos de Uso — Axyoma',
    description:
      'Termos e condições de uso do Axyoma AI: conta, créditos, chave própria, provedores de terceiros, execução de comandos na sua máquina, responsabilidades e limites.',
    alternates: alternatesFor('/termos', locale),
  }
}

// =============================================================================
// TERMOS DE USO
//
// MESMA REGRA DA POLÍTICA DE PRIVACIDADE: só entra afirmação verdadeira sobre o
// produto. Termo que descreve funcionalidade inexistente é tão ruim quanto
// política que promete proteção inexistente — com o agravante de virar
// obrigação contratual exigível.
//
// O QUE TORNA ESTES TERMOS DIFERENTES DE UM SaaS COMUM: o Axyoma não é um site
// onde o usuário digita e recebe resposta. Ele roda na máquina do usuário, LÊ e
// ESCREVE arquivos do projeto dele, EXECUTA comandos de terminal e abre Pull
// Requests. Um termo de SaaS padrão não cobre nada disso, e é justamente onde
// mora o maior risco — por isso a seção 8 existe e é específica.
//
// DECISÕES COMERCIAIS registradas pelo dono em 28/07/2026:
//   • crédito comprado NÃO expira;
//   • bônus e franquia expiram em 30 dias;
//   • uso proibido inclui usar a plataforma para construir concorrente;
//   • foro: Barueri/SP.
//
// ASSUMIDO POR FALTA DE DECISÃO EXPRESSA (sinalizado ao dono, trocar se ele
// discordar): política de reembolso alinhada ao art. 49 do CDC (7 dias de
// arrependimento, crédito não consumido) e ausência de SLA.
//
// ATENÇÃO — DIVERGÊNCIA CONHECIDA COM O SISTEMA: a expiração de bônus e
// franquia em 30 dias NÃO está implementada. Não existe função no banco que
// revogue saldo por prazo (`grant_signup_bonus` concede e nada expira). Até
// implementar, o usuário fica com mais do que o termo promete — o que não o
// prejudica, mas a regra só pode ser APLICADA a créditos concedidos depois da
// implementação. Expirar retroativamente crédito concedido sob outra
// expectativa é o tipo de coisa que se perde em juízo.
//
// PREÇO fica fora deste documento de propósito: mudar tabela de preço não pode
// exigir alterar contrato. A referência é a página de planos.
//
// PENDENTE DE REVISÃO JURÍDICA antes de uso em edital ou contrato corporativo.
// =============================================================================

const ATUALIZADO = '28 de julho de 2026'

const SECOES = [
  { id: 'aceitacao', titulo: 'Aceitação destes termos' },
  { id: 'definicoes', titulo: 'Definições' },
  { id: 'servico', titulo: 'O que o Axyoma é' },
  { id: 'conta', titulo: 'Conta e elegibilidade' },
  { id: 'creditos', titulo: 'Créditos e pagamento' },
  { id: 'byok', titulo: 'Chave própria (BYOK)' },
  { id: 'provedores', titulo: 'Provedores de terceiros' },
  { id: 'execucao', titulo: 'Execução na sua máquina' },
  { id: 'ia', titulo: 'Conteúdo gerado por IA' },
  { id: 'propriedade', titulo: 'Propriedade intelectual' },
  { id: 'proibido', titulo: 'Uso proibido' },
  { id: 'suspensao', titulo: 'Suspensão e encerramento' },
  { id: 'beta', titulo: 'Recursos em teste' },
  { id: 'mudancas-produto', titulo: 'Atualizações e mudanças' },
  { id: 'disponibilidade', titulo: 'Disponibilidade' },
  { id: 'responsabilidade', titulo: 'Limitação de responsabilidade' },
  { id: 'conformidade', titulo: 'Conformidade do usuário' },
  { id: 'alteracoes', titulo: 'Alterações destes termos' },
  { id: 'foro', titulo: 'Lei aplicável e foro' },
  { id: 'contato', titulo: 'Contato' },
]

export default async function TermosPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <ContentPage
      title="Termos de Uso"
      intro={`Última atualização: ${ATUALIZADO}. Estes termos regem o uso do aplicativo ${EMPRESA.produto}, do site ${EMPRESA.dominio} e dos serviços relacionados.`}
    >
      <Indice itens={SECOES} />

      <Secao id="aceitacao" titulo="1. Aceitação destes termos">
        <p>
          Ao criar uma conta, instalar o aplicativo ou utilizar qualquer funcionalidade do{' '}
          {EMPRESA.produto}, você declara que leu, compreendeu e concorda integralmente com estes
          Termos de Uso e com a <A href="/privacidade">Política de Privacidade</A>, que é parte
          integrante deles.
        </p>
        <p>
          Se você não concorda com alguma cláusula, não use o serviço. Se usa o {EMPRESA.produto} em
          nome de uma pessoa jurídica, você declara ter poderes para vinculá-la a estes termos.
        </p>
      </Secao>

      <Secao id="definicoes" titulo="2. Definições">
        <Lista
          itens={[
            <>
              <strong style={{ color: 'var(--ink)' }}>Plataforma</strong> — o aplicativo de desktop{' '}
              {EMPRESA.produto}, o site {EMPRESA.dominio} e os serviços de conta, créditos e
              intermediação de execuções.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Usuário</strong> — pessoa física ou jurídica
              que cria conta ou utiliza a Plataforma.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Fornecedor de IA</strong> — terceiro que
              disponibiliza os modelos executados por meio da Plataforma.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Modelo</strong> — sistema de inteligência
              artificial de um Fornecedor de IA, ou modelo executado localmente na máquina do
              Usuário.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Créditos</strong> — unidade interna de
              consumo, usada para pagar execuções feitas pela infraestrutura da Axyoma.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Chave própria (BYOK)</strong> — credencial de
              acesso a um Fornecedor de IA, contratada e paga pelo próprio Usuário.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Conteúdo do Usuário</strong> — instruções,
              arquivos, código, imagens e demais materiais que o Usuário envia ou permite que o
              agente leia.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Conteúdo Gerado</strong> — resultado produzido
              por um Modelo a partir do Conteúdo do Usuário.
            </>,
            <>
              <strong style={{ color: 'var(--ink)' }}>Agente</strong> — a função da Plataforma que,
              autorizada pelo Usuário, lê e altera arquivos e executa comandos na máquina dele.
            </>,
          ]}
        />
      </Secao>

      <Secao id="servico" titulo="3. O que o Axyoma é">
        <p>
          O {EMPRESA.produto} é uma plataforma de software que permite ao Usuário utilizar Modelos de
          inteligência artificial para executar tarefas de criação, planejamento e desenvolvimento
          por meio de uma interface unificada, instalada na máquina dele. O serviço é operado por{' '}
          {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}, com sede em {EMPRESA.cidade}.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>
            A Axyoma não desenvolve, não licencia e não revende Modelos de inteligência artificial.
          </strong>{' '}
          A Plataforma intermedia o acesso a Modelos de terceiros e oferece a interface, o
          agenciamento das execuções e a contabilidade de consumo. A qualidade, a disponibilidade e o
          comportamento de cada Modelo são de responsabilidade do respectivo Fornecedor de IA.
        </p>
        <p>
          O aplicativo está disponível para macOS e Windows. A execução com Modelos locais depende de
          software de terceiros instalado pelo próprio Usuário e do hardware da máquina dele.
        </p>
      </Secao>

      <Secao id="conta" titulo="4. Conta e elegibilidade">
        <p>
          O uso da Plataforma é restrito a maiores de 18 anos com capacidade civil para contratar. Ao
          criar conta, você se compromete a fornecer informações verdadeiras e mantê-las atualizadas.
        </p>
        <p>
          Você é responsável por manter a confidencialidade das suas credenciais e por toda atividade
          realizada na sua conta. Comunique-nos imediatamente se suspeitar de acesso não autorizado.
        </p>
        <p>
          É vedado criar múltiplas contas com o objetivo de obter repetidamente créditos de bônus ou
          de contornar limites de uso.
        </p>
      </Secao>

      <Secao id="creditos" titulo="5. Créditos e pagamento">
        <SubSecao titulo="5.1. Como funcionam">
          <p>
            Créditos são a unidade de consumo das execuções feitas pela infraestrutura da Axyoma.
            Cada execução consome créditos conforme o custo real do Modelo utilizado, informado antes
            da confirmação e registrado no seu extrato.
          </p>
          <p>
            Créditos não são moeda, não rendem juros, não são conversíveis em dinheiro e não são
            transferíveis entre contas. Os valores de compra e os critérios de conversão são os
            publicados na <A href="/#planos">página de planos</A>, que pode ser atualizada mediante
            aviso prévio — alterações não afetam créditos já adquiridos.
          </p>
        </SubSecao>

        <SubSecao titulo="5.2. Créditos comprados">
          <p>
            <strong style={{ color: 'var(--ink)' }}>Não expiram.</strong> Permanecem disponíveis
            enquanto a conta existir e valem para todos os Modelos do catálogo.
          </p>
        </SubSecao>

        <SubSecao titulo="5.3. Créditos de bônus e de franquia">
          <p>
            Créditos de bônus (concedidos no cadastro) e créditos de franquia (incluídos em planos
            pagos) são cortesias vinculadas a uma finalidade e a um período:
          </p>
          <Lista
            itens={[
              'Válidos exclusivamente para os Modelos da Vertex AI (Google Cloud).',
              'Expiram em 30 dias contados da concessão, e a franquia é renovada a cada ciclo do plano, sem acúmulo de saldo não utilizado.',
              'Não são reembolsáveis, não são conversíveis em dinheiro e podem ser cancelados em caso de fraude, abuso ou criação de contas em duplicidade.',
              'O encerramento do plano encerra a franquia; créditos comprados não são afetados.',
            ]}
          />
        </SubSecao>

        <SubSecao titulo="5.4. Pagamento">
          <p>
            Os pagamentos são processados por instituição de pagamento contratada pela Axyoma,
            atualmente via Pix. Não recebemos nem armazenamos dados de cartão. Os créditos são
            liberados após a confirmação do pagamento pela instituição.
          </p>
        </SubSecao>

        <SubSecao titulo="5.5. Arrependimento e reembolso">
          <p>
            Você pode desistir da compra em até <strong style={{ color: 'var(--ink)' }}>7 (sete)
            dias corridos</strong> contados da confirmação do pagamento, nos termos do art. 49 do
            Código de Defesa do Consumidor. O reembolso corresponde aos créditos{' '}
            <strong style={{ color: 'var(--ink)' }}>não consumidos</strong> e é feito pelo mesmo meio
            de pagamento.
          </p>
          <p>
            Créditos já consumidos não são reembolsáveis: a execução foi prestada e o custo
            correspondente já foi pago ao Fornecedor de IA. Fora da janela de 7 dias, pedidos de
            reembolso são analisados caso a caso, sem obrigação de deferimento.
          </p>
          <p>
            Para solicitar, escreva para <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A>.
          </p>
        </SubSecao>
      </Secao>

      <Secao id="byok" titulo="6. Chave própria (BYOK)">
        <p>
          Você pode optar por usar credenciais próprias junto a Fornecedores de IA compatíveis. Nessa
          modalidade, a execução vai da sua máquina diretamente ao Fornecedor, sem passar pela
          infraestrutura da Axyoma e sem consumir Créditos.
        </p>
        <Lista
          itens={[
            'A relação contratual, os preços, os limites de uso e a cobrança são estabelecidos entre você e o Fornecedor de IA. Todo custo gerado por essa credencial é de sua exclusiva responsabilidade.',
            'A Axyoma não intermedia, não audita e não tem visibilidade sobre esse consumo.',
            'A credencial é armazenada na sua máquina, cifrada pelo mecanismo do seu sistema operacional. A guarda do dispositivo e o controle de quem tem acesso a ele são seus.',
            'Cabe a você respeitar os termos de uso do Fornecedor. Suspensão ou cancelamento da sua credencial por decisão dele não gera responsabilidade da Axyoma.',
          ]}
        />
      </Secao>

      <Secao id="provedores" titulo="7. Provedores de terceiros">
        <p>
          O funcionamento de parte dos recursos depende de serviços de terceiros — Fornecedores de
          IA, provedores de infraestrutura, autenticação, busca na web e processamento de pagamentos.
          Esses serviços podem sofrer indisponibilidade, alteração de preço, mudança de comportamento
          dos Modelos, descontinuação de versões ou modificação de política, sem qualquer controle da
          Axyoma.
        </p>
        <p>
          A Axyoma pode incluir, substituir ou descontinuar Fornecedores de IA e demais operadores a
          qualquer momento, inclusive quando isso for necessário para manter o serviço disponível.
          Quando a mudança afetar Modelos que você usa, faremos o possível para avisar com
          antecedência razoável.
        </p>
        <p>
          A lista de operadores em uso é mantida atualizada na{' '}
          <A href="/privacidade#operadores">Política de Privacidade</A>.
        </p>
      </Secao>

      <Secao id="execucao" titulo="8. Execução na sua máquina">
        <p>
          Esta seção descreve o ponto em que o {EMPRESA.produto} difere de um software comum, e
          merece leitura atenta.
        </p>
        <p>
          Quando você autoriza, o Agente atua diretamente no seu ambiente:{' '}
          <strong style={{ color: 'var(--ink)' }}>lê arquivos do seu projeto, cria e altera
          arquivos, executa comandos no terminal do seu computador, instala dependências e pode
          publicar alterações em repositórios que você conectou</strong>.
        </p>
        <Lista
          itens={[
            'Essas ações rodam com as SUAS permissões de sistema e alcançam o que o seu usuário do sistema operacional alcança.',
            'A Plataforma oferece controles de autonomia — aprovação por ação, revisão de plano antes da execução e pontos de restauração. Cabe a você configurá-los no nível de risco que aceita e revisar o que foi proposto antes de aprovar.',
            'Comando executado é irreversível pelo aplicativo. Nossos pontos de restauração cobrem alterações feitas pelo Agente em arquivos do projeto; não substituem sistema de controle de versão nem cópia de segurança.',
            'Você é responsável por manter backups e por não apontar o Agente para ambientes de produção, dados sensíveis ou sistemas críticos sem as devidas salvaguardas.',
          ]}
        />
        <p>
          <strong style={{ color: 'var(--ink)' }}>
            A Axyoma não responde por perda de dados, alteração indevida de arquivos, execução de
            comandos destrutivos, custos de infraestrutura de terceiros ou indisponibilidade de
            sistemas decorrentes de ações que você autorizou o Agente a realizar.
          </strong>{' '}
          A decisão sobre o que executar, e sob qual nível de autonomia, é sua.
        </p>
      </Secao>

      <Secao id="ia" titulo="9. Conteúdo gerado por IA">
        <p>
          O Conteúdo Gerado é produzido por modelos estatísticos e{' '}
          <strong style={{ color: 'var(--ink)' }}>pode conter erros</strong>. Isso não é falha
          eventual, é característica da tecnologia. Em particular, o resultado pode:
        </p>
        <Lista
          itens={[
            'Afirmar com confiança informações falsas, inventadas ou desatualizadas.',
            'Produzir código incorreto, ineficiente ou com falhas de segurança.',
            'Reproduzir trechos semelhantes a obras protegidas por direito autoral.',
            'Conter viés ou impropriedade herdados dos dados de treinamento do Modelo.',
            'Variar entre execuções idênticas, sem garantia de reprodutibilidade.',
          ]}
        />
        <p>
          O Conteúdo Gerado é fornecido &ldquo;como está&rdquo;, sem garantia de exatidão,
          adequação a finalidade específica ou não violação de direitos de terceiros.{' '}
          <strong style={{ color: 'var(--ink)' }}>
            Cabe a você revisar, testar e validar antes de usar em produção ou tomar decisão com base
            nele
          </strong>{' '}
          — em especial quando envolver segurança, saúde, finanças, questão jurídica ou dado pessoal.
        </p>
        <p>
          A Plataforma não é, e não substitui, aconselhamento profissional de qualquer natureza.
        </p>
      </Secao>

      <Secao id="propriedade" titulo="10. Propriedade intelectual">
        <SubSecao titulo="10.1. Do Axyoma">
          <p>
            O software, a interface, a marca, o logotipo, a documentação e os elementos visuais da
            Plataforma são de titularidade da Axyoma ou de seus licenciantes. Estes termos concedem a
            você uma licença de uso pessoal, limitada, revogável, não exclusiva e intransferível, e
            não transferem qualquer direito de propriedade.
          </p>
        </SubSecao>
        <SubSecao titulo="10.2. Seu">
          <p>
            Você mantém a titularidade integral do Conteúdo do Usuário. Não reivindicamos direito
            sobre o seu código, seus arquivos ou seus projetos, e{' '}
            <strong style={{ color: 'var(--ink)' }}>
              não usamos o seu conteúdo para treinar modelos
            </strong>
            , conforme a <A href="/privacidade#conteudo">Política de Privacidade</A>.
          </p>
          <p>
            Você concede à Axyoma apenas a autorização técnica necessária para transmitir o Conteúdo
            do Usuário ao Fornecedor de IA que você escolheu e devolver o resultado — nada além
            disso, e apenas enquanto durar a execução.
          </p>
        </SubSecao>
        <SubSecao titulo="10.3. Do Conteúdo Gerado">
          <p>
            Entre você e a Axyoma, o Conteúdo Gerado é seu, e você pode usá-lo inclusive para fins
            comerciais. Ressalvamos que os direitos sobre resultado produzido por inteligência
            artificial ainda são matéria em construção no ordenamento jurídico, e que o uso pode
            estar sujeito aos termos do Fornecedor de IA que gerou o resultado.
          </p>
        </SubSecao>
      </Secao>

      <Secao id="proibido" titulo="11. Uso proibido">
        <p>É vedado utilizar a Plataforma para:</p>
        <Lista
          itens={[
            'Praticar ato ilícito ou violar legislação aplicável.',
            'Violar direito de propriedade intelectual, industrial ou de personalidade de terceiro.',
            'Desenvolver, distribuir ou operar malware, ransomware, ferramenta de invasão ou qualquer código destinado a causar dano.',
            'Acessar, sem autorização, sistema, rede, conta ou dado de terceiro.',
            'Gerar spam, desinformação em escala, conteúdo sexual envolvendo menores ou material que incite violência, ódio ou discriminação.',
            'Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte da Plataforma, salvo na extensão em que a lei expressamente permitir.',
            'Utilizar a Plataforma, no todo ou em parte, para desenvolver, treinar ou viabilizar produto ou serviço concorrente — incluindo copiar sua interface, seu fluxo de trabalho ou sua arquitetura, e usar o acesso para reconstruir funcionalidade equivalente.',
            'Revender, sublicenciar ou disponibilizar o acesso a terceiros fora dos planos contratados.',
            'Burlar limites de uso, cotas, controles de cobrança ou mecanismos de segurança, inclusive por criação de contas em duplicidade.',
            'Automatizar o uso de modo a comprometer a estabilidade, a disponibilidade ou a integridade do serviço, ou a onerar indevidamente a infraestrutura.',
          ]}
        />
      </Secao>

      <Secao id="suspensao" titulo="12. Suspensão e encerramento">
        <p>
          Você pode encerrar sua conta a qualquer momento, pelo aplicativo ou escrevendo para o
          contato da seção 20. O encerramento não gera direito a reembolso de créditos não
          utilizados, ressalvada a hipótese da cláusula 5.5.
        </p>
        <p>
          Podemos suspender ou encerrar o acesso, no todo ou em parte, nas seguintes situações:
        </p>
        <Lista
          itens={[
            'Violação destes termos, em especial da seção 11.',
            'Indício de fraude, uso de meio de pagamento de terceiro sem autorização ou contestação indevida de cobrança.',
            'Uso automatizado ou abusivo que ameace a estabilidade do serviço.',
            'Determinação legal ou ordem de autoridade competente.',
            'Risco iminente à segurança da Plataforma ou de outros usuários.',
          ]}
        />
        <p>
          Sempre que possível, avisaremos antes e daremos oportunidade de correção. Em caso de risco
          iminente, fraude ou determinação legal, a suspensão pode ser imediata. Suspensão indevida
          reconhecida por nós é revertida com restituição dos créditos afetados.
        </p>
      </Secao>

      <Secao id="beta" titulo="13. Recursos em teste">
        <p>
          Funcionalidades podem ser disponibilizadas como beta, prévia ou experimento. Elas são
          oferecidas &ldquo;como estão&rdquo;, podem apresentar instabilidade, mudar sem aviso e ser
          descontinuadas a qualquer momento, sem que isso gere direito a indenização ou reembolso.
          Quando um recurso estiver nessa condição, ele será identificado na interface.
        </p>
      </Secao>

      <Secao id="mudancas-produto" titulo="14. Atualizações e mudanças">
        <p>
          O aplicativo recebe atualizações periódicas, que podem ser aplicadas automaticamente e são
          necessárias para correção de falhas e de segurança. Podemos alterar, adicionar ou
          descontinuar funcionalidades, Modelos e integrações ao longo do tempo.
        </p>
        <p>
          Mudanças que reduzam de forma relevante uma funcionalidade contratada serão comunicadas com
          antecedência razoável. Se você não concordar, pode encerrar a conta; créditos comprados e
          não utilizados serão reembolsados proporcionalmente nessa hipótese.
        </p>
      </Secao>

      <Secao id="disponibilidade" titulo="15. Disponibilidade">
        <p>
          A Plataforma é fornecida em regime de melhor esforço.{' '}
          <strong style={{ color: 'var(--ink)' }}>
            Não garantimos disponibilidade contínua, ausência de interrupções, nem qualquer índice de
            tempo no ar (SLA).
          </strong>
        </p>
        <p>
          Pode haver indisponibilidade por manutenção programada, falha de infraestrutura, incidente
          de segurança ou interrupção em serviço de terceiro do qual dependemos — inclusive dos
          Fornecedores de IA, que estão fora do nosso controle.
        </p>
        <p>
          Compromissos formais de disponibilidade, quando existirem, serão objeto de contrato
          específico e não decorrem destes termos.
        </p>
      </Secao>

      <Secao id="responsabilidade" titulo="16. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela legislação aplicável, a Axyoma não responde por:
        </p>
        <Lista
          itens={[
            'Lucros cessantes, perda de receita, de oportunidade comercial ou de reputação.',
            'Perda, corrupção ou alteração de dados e de arquivos, inclusive decorrente de comandos executados pelo Agente com a sua autorização (seção 8).',
            'Danos indiretos, incidentais, especiais ou punitivos.',
            'Interrupção, lentidão ou indisponibilidade da Plataforma ou de serviços de terceiros.',
            'Decisão tomada com base em Conteúdo Gerado sem a revisão prevista na seção 9.',
            'Custos cobrados por Fornecedor de IA em razão de credencial própria do Usuário (seção 6).',
          ]}
        />
        <p>
          Nas hipóteses em que a responsabilidade da Axyoma for reconhecida, ela fica limitada ao
          valor efetivamente pago por você nos 12 (doze) meses anteriores ao evento que a originou.
        </p>
        <p>
          Nada nesta seção afasta responsabilidade por dolo, culpa grave ou direito que a legislação
          consumerista assegure de forma inafastável ao consumidor.
        </p>
      </Secao>

      <Secao id="conformidade" titulo="17. Conformidade do usuário">
        <p>Ao utilizar a Plataforma, você declara e garante que:</p>
        <Lista
          itens={[
            'Possui os direitos necessários sobre o Conteúdo do Usuário que envia, inclusive sobre código de terceiros e material licenciado.',
            'Se enviar dados pessoais de terceiros, o faz com base legal adequada, na condição de controlador desses dados, observada a Lei nº 13.709/2018 (LGPD).',
            'Cumprirá a legislação aplicável à sua atividade, inclusive obrigações setoriais e de sigilo profissional ou contratual.',
            'Não utilizará a Plataforma em desacordo com política de Fornecedor de IA cujos Modelos venha a executar.',
          ]}
        />
        <p>
          Você concorda em manter a Axyoma indene de reclamações de terceiros decorrentes do
          descumprimento desta seção.
        </p>
      </Secao>

      <Secao id="alteracoes" titulo="18. Alterações destes termos">
        <p>
          Podemos alterar estes termos para refletir mudanças no produto, na infraestrutura ou na
          legislação. A data de última atualização fica no topo da página. Alterações relevantes serão
          comunicadas por e-mail ou por aviso no aplicativo com antecedência mínima de 15 dias.
        </p>
        <p>
          Se você continuar usando a Plataforma após a entrada em vigor, considera-se que aceitou a
          nova versão. Se não concordar, pode encerrar a conta antes disso, aplicando-se a regra de
          reembolso da cláusula 14.
        </p>
      </Secao>

      <Secao id="foro" titulo="19. Lei aplicável e foro">
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil.
        </p>
        <p>
          Fica eleito o foro da Comarca de {EMPRESA.cidade} para dirimir controvérsias decorrentes
          destes termos, com renúncia a qualquer outro, por mais privilegiado que seja.
        </p>
        <p>
          Esta eleição não prejudica o direito do consumidor de demandar no foro do seu próprio
          domicílio, nos termos do art. 101, I, do Código de Defesa do Consumidor.
        </p>
      </Secao>

      <Secao id="contato" titulo="20. Contato">
        <p>
          Dúvidas, pedidos de reembolso e comunicações relativas a estes termos:{' '}
          <A href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</A>.
        </p>
        <p>
          {EMPRESA.razaoSocial} — CNPJ {EMPRESA.cnpj} — {EMPRESA.cidade}.
        </p>
      </Secao>
    </ContentPage>
  )
}
