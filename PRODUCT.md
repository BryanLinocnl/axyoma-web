# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Devs e "vibe coders" brasileiros que já usam IA para programar e cansaram de dois
atritos: a cota diária que trava no meio do trabalho e a exigência de montar uma
stack (chave de API, painel de provedor, integração) antes de escrever a primeira
linha. Chegam ao site pelo desktop, geralmente decidindo entre o Axyoma e um
concorrente que já conhecem. O trabalho deles na landing é simples: entender o que
o app é, se o modelo de crédito é honesto, e baixar.

Segundo público, menor: criadores que querem gerar arte para redes sociais no
mesmo app onde o código roda (Modo Design).

## Product Purpose

O Axyoma AI é um **app desktop** (macOS, Windows e Linux) que junta três modos de
trabalho num só shell:

- **Code** — agente que lê, escreve e edita arquivos do projeto, roda comandos no
  terminal, depura e entrega até o PR no GitHub.
- **Plan** — quebra a feature em tarefas revisáveis; nada executa antes da
  aprovação.
- **Design** — cria artes, posts e carrosséis para redes sociais (motor portado do
  OpenPencil).

Sucesso é o visitante baixar o app e chegar à primeira execução sem configurar
provedor nenhum.

## Positioning

**Sem chave de API e sem teto artificial de uso.** O acesso aos modelos passa por
um proxy próprio que guarda as chaves; o usuário paga em créditos Axyoma debitados
pelo custo real do modelo. Não há cota diária: o teto é quanto crédito a pessoa
decide gastar. Um concorrente que revende assinatura com limite mensal não
consegue copiar essa frase honestamente.

## Operating Context

App instalado na máquina, ao lado do editor e do terminal — o projeto é local, os
arquivos são os do usuário. Sessões longas, muitas vezes em tela cheia, dentro do
horário de trabalho e à noite. O login é OAuth pelo navegador; o saldo de crédito
e o catálogo de modelos vêm do proxy (`axyoma-web`) em tempo real.

O site tem duas metades: a landing pública (esta superfície) e a área logada
`/conta` (saldo, faturamento, uso, playground, docs).

## Capabilities and Constraints

- **Modelos disponíveis:** Gemini, Claude, GPT, Grok, Llama, DeepSeek, Kimi,
  Qwen, Mistral e outros, num seletor único. Logos oficiais dos provedores já
  existem em `public/providers/*.svg` (38 arquivos).
- **Créditos:** 1 crédito = R$ 0,30. Bônus de cadastro = **400 créditos**,
  controlado pela env `SIGNUP_BONUS_CREDITS` no proxy. Bônus e franquia valem
  para os modelos da Vertex AI; créditos comprados valem para todos.
- **Pagamento:** PIX ou cartão, no site ou no app.
- **Planos:** Free está no ar. Pro e Teams são **"em breve"**, sem preço
  anunciado — não inventar valores.
- **Sistemas:** macOS (Apple Silicon e Intel), Windows e Linux. Atualização
  automática no Windows e Linux; no macOS o app avisa que há versão nova.
- **Modo Design** está marcado como Pro · em breve.
- Site em **pt-BR**, domínio `https://axyoma.ia.br`.

## Brand Commitments

- Nome **Axyoma** (marca "Axyoma AI"). Logo em `components/AxiomaLogo.tsx`.
- O app foi redesenhado para o mundo **macOS Glass**: materiais translúcidos,
  azul profundo `#1D4ED8` como acento, laranja `#F5820B` reservado ao logo. A
  landing deve carregar essa mesma identidade — é a decisão do usuário, e é o que
  o visitante vai encontrar depois de instalar.
- Referência de estrutura fixada pelo usuário: o template Agenforce
  (`ui.aceternity.com`) — mesma ordem de seções, mesmo tipo de texto, tudo
  adaptado ao Axyoma.
- Voz: direta, concreta, sem hype. Frases curtas. Português do Brasil.

## Evidence on Hand

- **Existe:** logos de provedores (`public/providers/`), logo Apple e Linux, e um
  screenshot antigo do app (`public/code-mode.png`) — **descartado**: é do design
  laranja anterior e mostra o nome e o e-mail reais do usuário.
- **Não existe:** clientes, depoimentos, número de usuários, benchmarks, prêmios,
  logos de empresa. Nada disso pode ser fabricado. O lugar que o template reserva
  a "500+ enterprise companies" recebe os logos dos **modelos que rodam dentro do
  app** — verdade verificável.
- **Screenshots do produto:** não há prints atuais. Decisão do usuário: construir
  os mocks em HTML/CSS agora e deixar os componentes preparados para receber
  imagens reais depois, sem refazer layout.

## Product Principles

1. **Prova em vez de alegação.** Mostrar a interface fazendo o trabalho — o
   agente executando, o plano sendo aprovado, o crédito sendo debitado.
2. **Preço sem letra miúda.** Crédito, valor do crédito e o que o bônus cobre
   ficam visíveis; o que ainda não tem preço diz "em breve" e para por aí.
3. **Continuidade com o app.** O que o visitante vê no site é o que ele encontra
   depois de instalar. Sem bait visual.
4. **Nada de prova social inventada.** Sem clientes, o espaço é preenchido com
   fatos do produto.

## Accessibility & Inclusion

Contraste mínimo 4.5:1 em texto corrido — o material de vidro nunca reduz
legibilidade. `prefers-reduced-transparency` e `prefers-reduced-motion` são
respeitados (o app já os respeita). Navegação por teclado com foco visível.
