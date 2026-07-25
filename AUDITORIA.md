# Auditoria — axyoma-web (proxy + site)

Análise completa do repositório `axyoma-web` em 24/07/2026, feita depois das correções PR1–PR7 do app desktop. Cobre: as 13 rotas de API, o middleware, as libs de auth/billing/registry, a superfície de dados no Supabase (RLS, storage, RPCs — verificada direto no banco de produção) e as dependências.

Contexto: este repo é **as duas coisas ao mesmo tempo** — o site público (landing, conta, playground) e o **proxy de inferência** que guarda `OPENROUTER_KEY`, a service-role do Supabase e a federação com o Vertex. Toda falha aqui é falha de dinheiro ou de dados de todos os usuários ao mesmo tempo, diferente do desktop (onde o raio é a máquina de um usuário).

Escala: 13 rotas, ~3.500 linhas de handler, 15 libs, 25 tabelas com RLS.

---

## Resumo

| Sev | # | Estado |
|---|---|---|
| 🔴 Crítico | 1 | corrigido (PR #26) |
| 🟠 Alto | 4 | **corrigidos** (PR #27) |
| 🟡 Médio | 6 | 5 corrigidos (PR #27) · M-2 adiado (troca do modelo de sessão) |
| 🔵 Baixo | 5 | 4 corrigidos (PR #27) · B-2 aceito (timing em segredo aleatório) |

Os webhooks de pagamento (M-4), que estavam fora do escopo por viverem no outro
repo, foram auditados e corrigidos junto: `axyoma-ai#18`.

O que está **bem resolvido** e não deve ser mexido sem motivo: a federação WIF (`lib/google-auth.ts`) nunca loga token e renova preemptivamente; a allow-list de região (`isRegionAllowed`, fail-closed com lista vazia) fecha o SSRF do Vertex na origem; o ledger de vídeo (`video_charges` com claim condicional `submitted → charging`) é uma solução correta de idempotência de cobrança sob polling, com leitura escopada por `user_id` contra IDOR; o Vault para segredos de integração nunca devolve o valor ao browser; as 25 tabelas têm RLS ligada e as policies conferidas são todas `auth.uid() = user_id`; e os filtros do PostgREST são montados com `URLSearchParams`, que escapa vírgula — sem injeção de filtro.

---

## 🔴 Crítico

### P-1 — CORS quebrava o desktop (`Origin: null`) — **CORRIGIDO**
`lib/cors.ts`

Regressão da própria auditoria anterior (PR #25). O default deixou de ser `*` e passou a ser a origem do deploy — certo para browser, errado para o app: o renderer empacotado roda em `file://`, origem opaca, e o Chromium manda literalmente `Origin: null`, que não entra em allow-list de host. Resultado: `GET /api/v1/models` (lista de modelos) e `POST /api/v1/credits/bootstrap` (saldo/bônus) bloqueados pelo browser em **todos** os apps instalados. O chat não era afetado — sai do processo main, que não manda `Origin`.

Corrigido no PR #26: `Origin: null` recebe `*`. Seguro porque a autenticação destas rotas é Bearer no header, não cookie — sem `credentials: 'include'` o curinga não expõe sessão.

**Lição que vale para o resto da lista:** duas das três regressões desta rodada (CSP × Monaco, CORS × desktop) passaram por `tsc` e `build` verdes. O que falta no ciclo não é análise estática — é um smoke test de runtime.

---

## 🟠 Alto

### A-1 — Imagem e vídeo ainda gastam sem reserva (C-7 só foi corrigido no chat)
`app/api/v1/images/route.ts:209-217`, `app/api/v1/videos/route.ts:90-101`

O PR6 trocou o gate de leitura por reserva atômica (`hold_credits`) **apenas na rota de chat**. Imagem e vídeo continuam com exatamente o padrão que a auditoria classificou como crítico:

```ts
balanceBefore = await getBalance(userId)
if (!(balanceBefore > 0)) return 402   // ← só LÊ
… gera …
await debitUsage(...)                  // ← debita minutos depois
```

N requisições simultâneas leem o mesmo saldo e todas passam. Com 1 crédito de saldo dá para disparar o limite inteiro do rate-limit (10 imagens/min, 5 vídeos/min por usuário) e pagar 1. Vídeo é o pior caso: Veo custa por segundo e o débito só ocorre no `done` do polling.

O gate de custo estimado do vídeo (`VIDEO_MIN_BALANCE_MULT`) ajuda contra *um* pedido caro, mas não contra concorrência — é a mesma leitura sem lock.

**Correção:** aplicar `holdCredits`/`settleHold`/`releaseHold` (já existem, migration 0024) nas duas rotas. Vídeo tem uma sutileza boa: o hold é feito no submit e liquidado no `status`, o que casa com o ledger que já existe.

### A-2 — Next.js 15.5.20 com 8 advisories, inclusive SSRF e cache confusion
`package.json`

O lockfile resolve `next@15.5.20`; a correção é **15.5.21** (patch). A lista inclui SSRF em rewrites com hostname controlado pelo atacante, *cache confusion* de corpos de resposta (uma resposta pode ser servida para outro requisitante — grave num app com dados por usuário), DoS via Server Actions e disclosure de endpoints internos de Server Functions.

Não é exótico: é `npm i next@15.5.21`. É a correção de maior retorno por esforço do repo inteiro.

### A-3 — `/api/v1/models` é pública, sem rate limit, e vaza a tabela de preços
`app/api/v1/models/route.ts:26,65-66`

A rota não exige login (decisão consciente e documentada), mas devolve `input_price_usd_per_mtok` e `output_price_usd_per_mtok` da nossa tabela — as mesmas colunas que o item M-12 da auditoria anterior tratou como sensíveis quando fechou a leitura anônima de `public.models`. A migration fechou a porta do Postgres; esta rota é a janela aberta ao lado, sem nem exigir sessão.

Além do vazamento comercial, é a única rota sem autenticação **nem** rate limit que dispara duas chamadas externas (OpenRouter + Supabase) por request — martelar isso queima invocação da Vercel na nossa conta.

**Correção:** exigir JWT (o app e o site sempre têm sessão nesse ponto), ou manter público sem as colunas de preço; e um rate limit por IP.

### A-4 — Cap de gasto diário desligado por padrão
`app/api/v1/chat/completions/route.ts:104`

`DAILY_SPEND_CAP_USD` vem `0` = sem teto. Depois do PR6 uma conta não gasta *mais do que tem*, mas quem compra créditos (ou ganha bônus) pode consumir tudo numa janela curta, e não há freio por usuário/dia. Para um lançamento, um teto generoso (ex.: US$ 20/dia) é a diferença entre um incidente de US$ 20 e um de US$ 2.000. O código já está pronto e é fail-closed — só falta a env.

---

## 🟡 Médio

### M-1 — Sem CSP e sem headers de segurança fora de `/conta`
`middleware.ts:86-88`, `next.config.mjs`

O matcher é só `/conta/:path*`. Landing, `/login`, `/signup`, `/docs`, `/download` e as rotas de API saem **sem** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` — e o site inteiro não tem CSP nenhuma. `/login` sem `X-Frame-Options` é clickjacking de credencial; sem CSP, qualquer XSS futuro em página pública tem exfiltração livre.

**Correção:** mover os headers para `headers()` no `next.config.mjs` (vale para tudo, inclusive estáticos) e adicionar CSP começando em `report-only`.

### M-2 — Cookie de sessão legível por JS, com o access token inteiro
`lib/conta-context.tsx:32-38`

O `ContaProvider` espelha o access token num cookie não-httpOnly para o middleware conseguir gate-ar `/conta/admin`. O comentário argumenta que não é downgrade porque o token já está no localStorage — é verdade hoje, mas isso *fixa* o localStorage como modelo de sessão e dobra a superfície: agora um XSS tem duas fontes e o token vai em toda requisição same-site (o `SameSite=Lax` protege contra POST cross-site, não contra um subdomínio comprometido).

Vale como dívida consciente, não como bug — mas o caminho certo é sessão em cookie httpOnly (`@supabase/ssr`), que resolve middleware e XSS de uma vez.

### M-3 — Gate de admin do middleware não exige e-mail verificado
`middleware.ts:67-70`, `lib/auth.ts:81-87`

`verifyAccessToken` devolve `email` do claim sem checar `email_verified` — a correção do M-13 entrou só no `verifyUserWithEmail`. O impacto real é baixo (a API `/api/admin/metrics` usa a versão correta e é ela que serve os dados), mas o gate de página é o que decide o que *aparece*, e uma inconsistência dessas envelhece mal.

### M-4 — Sem verificação de assinatura visível nos webhooks de pagamento
`Aplication/supabase/functions/{abacatepay,asaas}-webhook` (fora deste repo)

O fluxo de compra do site chama as edge functions do Supabase; a validação de assinatura dos webhooks vive lá e **não foi auditada** nesta passada. É o ponto de maior valor do sistema inteiro (webhook forjado = crédito grátis ilimitado). Precisa de auditoria própria, no repo do app.

### M-5 — Comentários de fail-open desatualizados nas rotas
`images/route.ts:197`, `videos/route.ts:77`, `videos/status/route.ts:47`, `news/refresh/route.ts:24`

Os comentários dizem "Fail-open se a RPC não existir", mas o `checkRateLimit` virou fail-closed por padrão no PR6. Quem ler o código vai concluir o oposto do comportamento real — e, no caso do cron de notícias, o efeito colateral é silencioso: se a RPC de rate limit ficar indisponível, o cron para de rodar sem alarme.

### M-6 — `getBalance` + `debitUsage` fazem 3 round-trips por imagem para calcular créditos
`images/route.ts:344-353`

O `creditsCharged` sai do *delta de saldo* (`balanceBefore - balanceAfter`), o que exige uma leitura extra e é incorreto se qualquer outra cobrança do mesmo usuário acontecer no meio (o delta absorve a cobrança alheia). A RPC já devolve `credits_spent` — usar o retorno em vez do delta remove a corrida e um round-trip.

---

## 🔵 Baixo

### B-1 — `sharp` e `postcss` com advisories altos (build/imagem)
Transitivas do Next. `postcss` tem path traversal via `sourceMappingURL` (só build) e `sharp` herda CVEs do libvips (usado pelo Image Optimization). Resolvem junto com o A-2 na maioria dos casos.

### B-2 — Comparação de `CRON_SECRET` não é constant-time
`news/refresh/route.ts` — `header === 'Bearer ' + secret`. Timing attack remoto sobre segredo aleatório é impraticável; anotado por completude.

### B-3 — Convenção de path do Storage inconsistente entre imagem e vídeo
Imagem grava `"<uid>/<uuid>.png"`; vídeo grava `"video/<uid>/<uuid>.mp4"`. As policies `gen_*` casam `foldername[1] = auth.uid()`, então **as policies não cobrem os vídeos** — hoje funciona porque a rota assina a URL com service-role, mas qualquer leitura futura via RLS vai falhar sem motivo aparente.

### B-4 — `avatars_write_own` concede INSERT ao papel `public`
A checagem `foldername[1] = auth.uid()::text` faz o anônimo falhar na prática (`auth.uid()` é null), então é inofensivo hoje — mas é uma policy escrita para `public` onde deveria estar `authenticated`.

### B-5 — `@vercel/functions` na dependência raiz
Usado só via `@vercel/functions/oidc` (WIF). O entrypoint raiz puxa `ws` e já quebrou o build edge uma vez. Manter a importação sempre no subpath e documentar isso evita a repetição.

---

## Recomendações, em ordem

1. **Agora (antes do lançamento)**
   - `npm i next@15.5.21` (A-2)
   - `holdCredits` em imagem e vídeo (A-1)
   - `DAILY_SPEND_CAP_USD` com um teto (A-4)
   - Fechar ou autenticar `/api/v1/models` (A-3)
2. **Semana do lançamento**
   - Headers de segurança globais + CSP em report-only (M-1)
   - Auditar os webhooks de pagamento (M-4)
   - Corrigir os comentários de fail-open (M-5)
3. **Depois**
   - Sessão em cookie httpOnly via `@supabase/ssr` (M-2, M-3 juntos)
   - Padronizar o path do Storage (B-3)

## O que falta no processo, não no código

Três regressões desta rodada (CSP × Monaco, CORS × desktop, e o `libc` do lockfile no PR do Snyk) tinham `tsc` e `build` verdes. Nenhuma análise estática pegaria: são falhas de **integração em runtime**. O menor investimento que fecha essa classe inteira é um smoke test que sobe o app empacotado e o site, faz login, abre um editor, lista modelos e manda um prompt barato — rodando no CI antes de publicar instalador.
