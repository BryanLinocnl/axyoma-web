# PRD — AXYOMA AI (site + dashboard)

Documento de produto para reformular a **landing page** e o **dashboard** do `axyoma-web`. Escrito para uma IA/dev que não conhece o projeto: contém o que o produto é, todas as funcionalidades, o modelo de negócio, o guia de marca e o que cada tela precisa entregar.

> Escopo deste repo (`axyoma-web`, deploy Vercel): **site institucional + área do usuário + proxy de LLM**. NÃO é o app desktop — o app é um projeto separado (Electron). Aqui mora: landing, auth, dashboard de conta, docs, e as rotas de API (`/api/v1/*`) que já existem e **não devem ser quebradas**.

---

## 1. O que é o AXYOMA AI

Um **estúdio de engenharia com IA** em app desktop (macOS/Windows/Linux). O usuário cria artes, planeja features e escreve código — tudo num app só, usando os melhores modelos de LLM, com **créditos que ele controla** (não precisa de chave própria de API). Tagline atual: *"Desenhe, planeje e code com IA."*

**Público-alvo:** desenvolvedores, makers, agências e freelancers que querem um agente de IA que executa (não só sugere), sem montar infraestrutura.

**Diferencial central:** o app tem um **agente que faz** (lê/escreve arquivos, roda comandos, depura, entrega) + modos de **Design** e **Planejamento** no mesmo lugar. E o modelo de **créditos** tira a fricção de gerenciar chaves de API.

---

## 2. Os três modos (núcleo do produto)

O app tem 3 modos, alternados por um seletor no topo. São o coração da narrativa de marketing:

### Design

Criação de artes para redes sociais: **posts, carrosséis, motions e templates**. A IA desenha, o usuário ajusta e publica. (Hoje é exclusivo do plano Pro e Temas — a tela mostra uma vitrine cósmica com a logo animada.)

### Plan

**Planejamento antes de codar.** Quebra a feature em tarefas, gera um plano revisável, e só executa após aprovação. Dá controle passo a passo — o usuário não fica refém de um agente que faz tudo de uma vez.

### Code

**Um agente de codificação que executa de ponta a ponta:** lê, escreve e edita arquivos de qualquer linguagem/framework, roda comandos (testes, lint, build, migrações), depura lendo logs, e entrega até o PR no GitHub. Tem terminal integrado, editor Monaco, timeline visual de cada ação (tool call), e integração com GitHub.

---

## 3. Funcionalidades (para popular features/docs)

- **Multi-modelo:** catálogo como os principais modelos de ia do mundo num seletor só (Claude, GPT, Gemini, Grok, Llama, DeepSeek, Kimi, etc.). O usuário escolhe por tarefa.
- **Créditos, sem chave de API:** o usuário não precisa fornecer chave — usa os créditos AXYOMA. 1 crédito = R$ 0,30. Paga só o que usa. Débito calculado pelo custo real (USD) do modelo.
- **Agente com ferramentas:** ler/escrever/editar arquivos, rodar comandos, screenshot, busca web, sub-agentes (delegar a outros modelos para realizarem tarefas ou competirem numa solução), skills.
- **Plan Mode / Product Owner:** planejar em tarefas, revisar, aprovar, executar.
- **Terminal integrado** e **editor de código** (Monaco) embutidos.
- **Integração GitHub:** criar/atualizar PR, exportar projeto.
- **Skills:** comandos/instruções reutilizáveis criadas pelo usuário.
- **Auto-update:** o app se atualiza sozinho (Windows/Linux); no macOS notifica e o usuário baixa a nova versão.
- **Multiplataforma:** macOS (Apple Silicon + Intel), Windows, Linux.

---

## 4. Modelo de negócio / planos

- **Free:** R$ 0 — **100 créditos de bônus** ao criar a conta. Compra mais quando quiser. Acesso a todos os modelos e ao app completo.
- **Pro:** R$ 197/mês — 400 créditos/mês + compra de extras.
- **Teams:** R$ 497/mês — até 4 membros e 1.600 créditos compartilhados.
- **Design mode** é exclusivo de plano pago (Pro e Teams).
- **Pagamento:** PIX e Cartão de Crédito (checkout no site/app).

---

## 5. O que o SITE precisa entregar (landing)

Objetivo: **converter visitante → download grátis + criação de conta.**

Seções sugeridas (a IA pode reorganizar):

1. **Hero Section** — logo, tagline, CTA "Baixar grátis" + "Criar conta", nota "100 créditos grátis ao criar a conta".
2. **Os 3 modos** (Design / Plan / Code) — o pilar do produto.
3. **Como funciona** — baixar → criar conta (100 créditos) → escolher modelo → criar.
4. **Prova/valor** — multi-modelo, agente que executa, créditos sem chave.
5. **Planos** — Free / Pro / Teams (transparência de preço).
6. **CTA final de download** (detecta SO) + rodapé (docs, login).
7. Redes sociais (apenas x e Insagram por enquanto)

Downloads vêm do repo público `github.com/BryanLinocnl/AXIOMA-AI-releases`(releases). Já existe release `v0.1.1`. O botão pode apontar pra `releases/latest` ou, melhor, buscar o asset por SO via API do GitHub.

---

## 6. O que o DASHBOARD precisa entregar (área logada, `/conta`)

Design **normal/limpo** (NÃO cósmico — ver §7). É a ferramenta de gestão da conta:

- **Perfil**: nome, e-mail, plano atual.
- **Saldo de créditos** (número + equivalente em R$) e total comprado.
- **Comprar créditos** (checkout PIX via edge function `abacatepay-create-checkout`).
- **Custo diário** (gráfico dos últimos dias, a partir de `usage_log`).
- **Gasto hoje / 30 dias** (KPIs).
- **Histórico de uso**: modelo, tokens, créditos, data (`usage_log`).
- **Documentação** e **link de download** do app.
- **Gestão de plano/assinatura** (Pro/Teams).
- Uma aba de notícias onde teremos posts diários sobre inteligência artificial.

Fonte de dados: **Supabase** (mesmo projeto do app). Tabelas relevantes: `profiles`, `credits` (balance, total_purchased), `usage_log`, `subscriptions` + `plans`. Auth = Supabase (email/senha + Google/Apple OAuth). O login do site deve **espelhar o login do app** (Apple + Google + email/senha, com "esqueceu a senha" e termos).

---

## 7. Guia de marca e design

**Duas linguagens, deliberadamente:**

- **Institucional (landing, download, login):** **cósmico**. Preto profundo, campo de estrelas, gradiente âmbar→vermelho da marca (`#fcb31b → #fb860a → #f6400e → #e32111`), **Playfair Display itálico** nos destaques, Inter no corpo. Motivo visual: um "palco" preto com a logo e um **feixe de luz orbital**(animação de energia). Imersivo, premium.
- **Interno (dashboard):** **normal/limpo**, sem cosmos. Fundo neutro escuro, cards, tabelas, gráficos. Âmbar só nos acentos. Prioriza clareza e uso, não arte.

**Logo:** o "A" com o brilho central (estrela), gradiente âmbar→vermelho fixo. Nome exibido como "Axyoma" em Playfair itálico.

**Tom:** direto, confiante, brasileiro (pt-BR). Evitar jargão. Enfatizar "controle" (créditos, planejamento antes de executar) e "faz por você" (agente).

---

## 8. Vantagens de uso (argumentos de venda)

- **Sem gerenciar chaves de API** — cria conta, ganha créditos, usa.
- **Só paga o que usa** — crédito por consumo real, sem assinatura obrigatória.
- **Todos os modelos num lugar** — troca de modelo por tarefa, sem trocar de app.
- **Agente que executa** — do plano ao PR, sem sair do app.
- **Controle** — Plan mode revisa antes de agir; nada roda sem aprovação.
- **Multiplataforma + auto-update.**

---

## 9. Restrições técnicas (NÃO quebrar)

- As rotas `/api/v1/chat/completions` e `/api/v1/models` (proxy de LLM) já existem e são consumidas pelo app desktop — **mantê-las intactas**.
- Env vars já configuradas na Vercel: `OPENROUTER_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server, secretas), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cliente).
- Stack atual: **Next.js 15 (App Router) + Tailwind v4 + Supabase JS**. Manter, a menos que haja motivo forte.
- Projeto Supabase: `ygtbhturvumpqgotctmr`. RLS ativa (usuário lê só o que é seu).
- Deploy: Vercel (projeto `axyoma-web`).

---

## 10. Estado atual (ponto de partida)

Já existe uma primeira versão funcional no `axyoma-web`: landing cósmica, login, dashboard, download, docs. A IA pode **reformular o design** livremente, desde que preserve as funcionalidades (§5, §6) e as restrições técnicas (§9). O objetivo é elevar o acabamento visual e a conversão, mantendo o produto coerente com a marca (§7).