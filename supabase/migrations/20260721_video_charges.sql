-- =============================================================================
-- Vídeo (Veo) — LEDGER da operação assíncrona + idempotência de cobrança.
--
-- A linha é criada NO SUBMIT (POST /api/v1/videos), assim que a Vertex devolve o
-- `operationId`, com status 'submitted' e a DURAÇÃO real submetida. O /status passa
-- a cobrar SEMPRE por `duration_seconds` ARMAZENADA aqui — NUNCA por query param do
-- client (que poderia submeter 8s e pollar 4s → subcobrança). Se a linha não existir
-- no /status, o `op` é inválido (ou de outro usuário) → 404.
--
-- IDEMPOTÊNCIA: o client polla o /status até a operação Vertex concluir (done). O
-- `done` pode chegar 2+ vezes (polls concorrentes/repetidos) → risco de dupla
-- cobrança. O CLAIM é um UPDATE condicional 'submitted' -> 'charging' (filtro
-- status=eq.submitted, escopo user_id): quem VENCE o update é o único que sobe o
-- vídeo, debita e finaliza (path + status 'done'); os demais leem a linha (path
-- preenchido → done; senão running).
--
-- ISOLAMENTO (anti-IDOR): toda leitura/claim/finalize escopa `user_id`. Um `op` de
-- outro usuário nunca assina URL nem é cobrado no contexto do requisitante.
--
-- Também estende o CHECK de `pending_charges.kind` para incluir 'video' (o marcador
-- de reconciliação usado quando o débito de vídeo lança exceção).
--
-- Idempotente. NÃO aplicar automaticamente — revisar e aplicar manualmente.
-- =============================================================================

create table if not exists public.video_charges (
  op               text primary key,          -- nome completo da operação Vertex (unique)
  user_id          uuid not null references auth.users(id) on delete cascade,
  model            text,                       -- id canônico do modelo (server-stored no submit)
  duration_seconds int,                        -- DURAÇÃO real submetida (fonte de verdade da cobrança)
  status           text not null default 'submitted',
  path             text,                        -- path do vídeo no Storage (bucket 'generations')
  credits          numeric,                     -- créditos debitados (delta de saldo real)
  cost_usd         numeric,                     -- custo bruto USD (auditoria)
  created_at       timestamptz not null default now()
);

-- Idempotência de re-run: garante as colunas/constraint novas mesmo que a tabela já
-- exista de uma versão anterior desta migration (create if not exists não altera).
alter table public.video_charges add column if not exists duration_seconds int;
alter table public.video_charges add column if not exists model text;
alter table public.video_charges add column if not exists path text;
alter table public.video_charges add column if not exists credits numeric;
alter table public.video_charges add column if not exists cost_usd numeric;

alter table public.video_charges alter column status set default 'submitted';
alter table public.video_charges drop constraint if exists video_charges_status_check;
alter table public.video_charges
  add constraint video_charges_status_check check (status in ('submitted', 'charging', 'done'));

alter table public.video_charges enable row level security;

-- O DONO pode LER suas próprias linhas (via user_id). Escrita é EXCLUSIVA da
-- service-role (nenhuma policy de insert/update/delete p/ anon/authenticated).
drop policy if exists "video_charges_select_own" on public.video_charges;
create policy "video_charges_select_own" on public.video_charges
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.video_charges from anon, authenticated;

-- Estende o CHECK de pending_charges.kind para aceitar 'video'.
alter table public.pending_charges drop constraint if exists pending_charges_kind_check;
alter table public.pending_charges
  add constraint pending_charges_kind_check check (kind in ('chat', 'image', 'video'));
