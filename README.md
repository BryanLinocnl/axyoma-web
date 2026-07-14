# axyoma-web

Landing page + **proxy de LLM** da AXYOMA AI. Deploy na Vercel. Guarda a chave da
OpenRouter server-side e valida créditos antes de cada request.

## Rotas do proxy
- `POST /api/v1/chat/completions` — OpenAI-compatible, streaming. Verifica o JWT
  do Supabase, checa saldo (402 se ≤ 0), injeta a chave real da OpenRouter,
  repassa o SSE e debita o custo real (USD) no fim do turno.
- `GET /api/v1/models` — catálogo da OpenRouter (exige JWT).

## Variáveis de ambiente (Vercel → Project → Settings → Environment Variables)
Ver `.env.example`. Obrigatórias:
- `OPENROUTER_KEY` — chave real da OpenRouter (**secreta**).
- `SUPABASE_URL` — `https://ygtbhturvumpqgotctmr.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role (**secreta**; só o proxy usa).
- `SUPABASE_JWT_SECRET` — só se o projeto usa HS256; senão deixe vazio (usa JWKS).

## Pré-requisito no Supabase
Aplicar a migration `0015_llm_proxy_and_free_bonus.sql` (do repo do app), que cria
as RPCs `spend_openrouter_usage_admin` e `get_balance_admin` e ajusta o free tier.

## Rodar local
```bash
npm install
cp .env.example .env   # preencha as chaves
npm run dev            # http://localhost:3000
```

## Testar o proxy (com um JWT de usuário válido)
```bash
curl -N http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer <JWT_DO_SUPABASE>" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"oi"}]}'
```
Esperado: SSE em stream; `usage_log` novo e `credits.balance` menor no Supabase.
Sem saldo → `402`. JWT inválido → `401`.

## Deploy
```bash
vercel            # primeira vez: linka o projeto
vercel --prod
```
Depois, no app Electron, aponte `MAIN_VITE_PROXY_URL` para a URL do deploy.
