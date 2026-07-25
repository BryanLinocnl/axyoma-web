---
name: Axyoma Web — Glass Bench
description: Landing do Axyoma no mesmo mundo macOS Glass do app — luz de ateliê, painéis de vidro sobre uma mesa clara, azul profundo como único acento
colors:
  ground: "#F4F6F9"          # a "mesa": cinza-azulado muito claro, nunca branco puro
  ground-raised: "#FFFFFF"   # papel/painel opaco por cima da mesa
  ink: "#14161A"
  ink-muted: "#5B6070"   # 5,79:1 sobre a mesa
  ink-faint: "#696E80"   # 4,68:1 sobre a mesa — piso de 4.5 respeitado
  accent: "#1D4ED8"          # azul profundo — o acento do app
  accent-hover: "#2563EB"
  accent-wash: "#EEF2FF"     # campo azul claro para regiões inteiras
  brand-mark: "#F5820B"      # laranja: SÓ no logo
  hairline: "rgba(16, 22, 34, 0.10)"
  highlight: "rgba(255, 255, 255, 0.62)"
  material-thick: "rgba(252, 252, 254, 0.86)"
  material-regular: "rgba(250, 251, 253, 0.68)"
  material-thin: "rgba(248, 250, 252, 0.46)"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', 'Schibsted Grotesk', sans-serif"
    fontWeight: 500
    lineHeight: "0.98"
    letterSpacing: "-0.035em"
  ui:
    fontFamily: "'Schibsted Grotesk', -apple-system, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: "1.55"
    letterSpacing: "-0.006em"
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  '2xl': "28px"
  pill: "999px"
shadow:
  panel: "0 24px 60px -28px rgba(16, 22, 34, 0.34)"
  float: "0 10px 30px -12px rgba(16, 22, 34, 0.24)"
  press: "0 1px 2px rgba(16, 22, 34, 0.16)"
---

# Axyoma Web — Glass Bench

## Direction contract

**THESIS.** A landing é a **bancada onde o app está aberto**: painéis de vidro do
Axyoma pousados numa mesa clara, inclinados como se alguém tivesse acabado de
girar a tela pra te mostrar. Recusa a landing-de-IA padrão — fundo quase preto,
gradiente roxo, grade de cards iguais com ícone-título-parágrafo — e recusa
também o oposto previsível, o wireframe branco sem material nenhum. O visitante
não lê sobre o produto: ele olha pra dentro dele.

**OWN-WORLD.** Mesa `#F4F6F9` (nunca branco puro), tinta quase preta, **azul
profundo `#1D4ED8`** como único acento, laranja só no logo. Painéis de vidro com
`backdrop-filter: blur(24px) saturate(180%)`, hairline de luz no topo
(`inset 0 1px 0 rgba(255,255,255,.62)`) e sombra de offset longo. Tipografia
Bricolage Grotesque em display gigante e apertado, Schibsted Grotesk no corpo,
JetBrains Mono só onde há código ou número medido. Cantos 14–28px. Separação por
hairline, não por caixa.

**STORY.** O visitante entende em um viewport que é um app de desktop com três
modos, vê o agente trabalhando, descobre que não precisa de chave de API nem
enfrenta cota diária, confere o preço do crédito e baixa.

**FIRST VIEWPORT.** Display de duas linhas alinhado à esquerda ocupando a metade
esquerda; sub em uma linha e meia; botão azul sólido "Baixar grátis" + link
secundário. À direita e vazando pela borda inferior, o **shell do Axyoma em
perspectiva 3D** sobre uma superfície azul-clara desfocada — o vidro tem algo
real atrás para desfocar. Ação primária acima da dobra, à esquerda.

**FORM.** Direção FIXADA pelo usuário: estrutura e ritmo do template Agenforce,
identidade do mundo macOS Glass do app (`Aplication/DESIGN.md`). Sem sorteio —
brief pinado nos dois eixos.

## Colors

- **Mesa clara é o corpo.** `#F4F6F9` no fundo; painéis opacos em `#FFFFFF`
  aparecem só onde há conteúdo denso (planos, FAQ). Nunca branco puro em área
  grande — é ele que faz o vidro sumir.
- **Azul `#1D4ED8` é o único acento.** Botão primário, link, estado selecionado,
  número que importa. Onde o azul precisa cobrir região inteira, usa
  `accent-wash` (`#EEF2FF`) como campo, não como sombra colorida.
- **Laranja `#F5820B` só no logo.** Nunca vira acento de UI, nunca vira gradiente.
- **Sem texto em gradiente.** Ênfase vem de peso e tamanho.
- **Paleta de ilustração** (só dentro dos mocks e das pranchetas, nunca no
  chrome da página): rampa do acento `#3b82f6` / `#1e40af`; diff `#15803d`
  sobre `rgba(21,128,61,.09)` e `#b42318` sobre `rgba(220,38,38,.08)` —
  vermelho e verde aqui são semântica de diff, não decoração; peças de rede
  social `#0f172a`/`#1e293b` (noturna) e `#f5820b`/`#ea580c` (laranja da marca,
  usada como cor da ARTE, não como acento de UI); semáforo do macOS `#ff5f57`
  `#febc2e` `#28c840`, que são cores do sistema operacional e não nossas.
- Texto corrido ≥4.5:1 sobre qualquer material. Secundário é `#5B6070` (5,79:1)
  e terciário `#696E80` (4,68:1) — **não existe** nível de cinza mais claro que
  isso carregando texto. O terciário parece muito escuro para um "faint"
  justamente porque a mesa é clara: cinza de 3:1 sobre `#F4F6F9` é o erro que
  esta paleta existe para não cometer.

## Typography

- **Display: Bricolage Grotesque 500**, tracking `-0.035em`, line-height `0.98`.
  Hero até 84px; títulos de seção 44–56px. Sempre duas linhas curtas, alinhado à
  esquerda, `text-wrap: balance`.
- **Corpo: Schibsted Grotesk** 400/500, 16–18px, medida 60–70ch.
- **Mono: JetBrains Mono** só em código, caminho de arquivo, diff e valor medido.
  Nunca como fantasia de "técnico".
- Sem serifa. Sem itálico decorativo. Hierarquia por peso e escala.

## Layout

- Container 1200px, gutter 20px no mobile / 24px acima.
- Ritmo vertical único: `py-20` mobile, `py-32` desktop. Mais espaço acima de um
  título do que abaixo.
- **Separação por hairline**, herdada do app: grades de features são colunas
  divididas por linha de 1px, não caixas. Cards só onde o conteúdo é mesmo uma
  unidade destacável (plano, FAQ).
- Alterna densidade: viewport de mock grande → passagem densa de texto → respiro.

## Elevation & Depth

- Profundidade = **material + blur + sombra de offset longo**. Nada de borda
  grossa, nada de halo colorido sem offset.
- Todo painel de vidro leva o hairline de luz no topo.
- **O vidro só existe onde há algo atrás pra desfocar**: a navbar flutuante sobre
  o conteúdo que rola, e os mocks sobre a superfície azul-clara. Vidro sobre
  branco chapado é decoração — proibido.
- Perspectiva 3D dos mocks: `perspective: 2000px` no palco,
  `rotateX(~14deg) rotateZ(~-8deg)` no painel, máscara de fade na borda que sai
  da tela.

## Shapes

- Raio: sm 6 / md 10 / lg 14 / xl 20 / 2xl 28 / pill. Botão md, painel lg,
  cartão grande 2xl.
- Ícones lucide com stroke fino (1.5). Ícone dentro de quadrado colorido é o
  atalho que a categoria usa — evitar; o ícone fica solto ao lado do rótulo.

## Motion

- **Um momento autorizado:** os painéis do app assentam na inclinação no primeiro
  paint (translateY + blur → nítido, ease-out exponencial) e o mock do hero troca
  de modo sozinho, em ciclo lento, como se alguém estivesse usando.
- O resto é resposta a intenção: hover de botão, abertura do FAQ, foco.
- Nada de a mesma animação de entrada em toda seção.
- `prefers-reduced-motion` corta ciclo e entrada; o conteúdo já está visível por
  padrão.

## Components

- **navbar:** pill de vidro flutuante, material thin + hairline, encolhe ao rolar.
- **button-primary:** `#1D4ED8` sólido, texto branco, raio md, sombra press.
- **button-secondary:** material thin, hairline, tinta escura.
- **app-mock:** shell completo (traffic lights, toolbar Design/Plan/Code, sidebar
  de vidro, palco de chat, composer). Componente isolado, trocável por `<Image>`
  de print real sem mexer no palco 3D.
- **feature-grid:** colunas separadas por hairline; ícone + título + parágrafo em
  linha, sem caixa.
- **plan-card:** painel branco raio 2xl, preço em display, checks em azul.
- **faq:** `<details>` nativo, painel branco raio xl, `+` que gira.

## Dark

Herda o dark do app: fundo `oklch(0.202 0.006 264)`, superfícies opacas (sem
translucidez — no escuro o vidro lava a imagem), acento `#2563EB`. É modo
secundário; a landing foi composta na luz.
