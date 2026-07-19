-- =============================================================================
-- Dashboard foundation (Fase 0.2) — tabelas novas do rework do dashboard.
--
-- O que este arquivo faz:
--   * Cria as tabelas: model_selection, integrations_config, error_reports,
--     image_generations, chat_conversations, chat_messages, model_news.
--   * Estende `profiles` com company, role, avatar_url.
--   * Habilita RLS em TODAS as tabelas novas desde o nascimento, com políticas
--     escopadas por auth.uid() (o dono só lê/escreve as próprias linhas).
--   * model_news: SELECT liberado a `authenticated`; INSERT/UPDATE só via
--     service-role (revoke de anon/authenticated).
--   * Habilita Supabase Realtime em model_selection (o app desktop assina
--     postgres_changes da própria linha para sincronizar a seleção de modelos).
--
-- Segurança:
--   * Nenhuma tabela guarda segredos/tokens (integrations_config é config
--     NÃO-sensível; segredos ficam fora daqui — ver Fase 3 / Supabase Vault).
--   * RLS respeitada também pelo Realtime (o desktop assina com o JWT do dono).
--   * Idempotente: seguro re-rodar (if not exists / drop policy if exists).
--
-- IMPORTANTE: NÃO aplicar automaticamente. Revisar e aplicar manualmente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: colunas novas (não mexe nas policies existentes de profiles).
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists company text,
  add column if not exists role text,
  add column if not exists avatar_url text;

-- -----------------------------------------------------------------------------
-- model_selection (P3): modelos que o usuário deixou ativos.
-- PK composta (user_id, model_id). Sincroniza com o desktop via Realtime.
-- -----------------------------------------------------------------------------
create table if not exists public.model_selection (
  user_id    uuid not null references auth.users(id) on delete cascade,
  model_id   text not null,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

alter table public.model_selection enable row level security;

drop policy if exists "model_selection_select_own" on public.model_selection;
create policy "model_selection_select_own" on public.model_selection
  for select using (auth.uid() = user_id);

drop policy if exists "model_selection_insert_own" on public.model_selection;
create policy "model_selection_insert_own" on public.model_selection
  for insert with check (auth.uid() = user_id);

drop policy if exists "model_selection_update_own" on public.model_selection;
create policy "model_selection_update_own" on public.model_selection
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "model_selection_delete_own" on public.model_selection;
create policy "model_selection_delete_own" on public.model_selection
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- integrations_config (P4): config NÃO-sensível de integrações (github/vercel/mcp)
-- sincronizada na nuvem. Segredos/tokens NÃO entram aqui.
-- PK composta (user_id, provider).
-- -----------------------------------------------------------------------------
create table if not exists public.integrations_config (
  user_id    uuid not null references auth.users(id) on delete cascade,
  provider   text not null check (provider in ('github', 'vercel', 'mcp')),
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.integrations_config enable row level security;

drop policy if exists "integrations_config_select_own" on public.integrations_config;
create policy "integrations_config_select_own" on public.integrations_config
  for select using (auth.uid() = user_id);

drop policy if exists "integrations_config_insert_own" on public.integrations_config;
create policy "integrations_config_insert_own" on public.integrations_config
  for insert with check (auth.uid() = user_id);

drop policy if exists "integrations_config_update_own" on public.integrations_config;
create policy "integrations_config_update_own" on public.integrations_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "integrations_config_delete_own" on public.integrations_config;
create policy "integrations_config_delete_own" on public.integrations_config
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- error_reports (P7): usuário reporta bug/sugestão/feature.
-- RLS: insert próprio + select próprio. Admin lê via service-role (bypassa RLS).
-- -----------------------------------------------------------------------------
create table if not exists public.error_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('bug', 'suggestion', 'feature')),
  title      text not null,
  body       text,
  status     text not null default 'open',
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.error_reports enable row level security;

drop policy if exists "error_reports_select_own" on public.error_reports;
create policy "error_reports_select_own" on public.error_reports
  for select using (auth.uid() = user_id);

drop policy if exists "error_reports_insert_own" on public.error_reports;
create policy "error_reports_insert_own" on public.error_reports
  for insert with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- image_generations (P6): histórico de gerações de imagem.
-- -----------------------------------------------------------------------------
create table if not exists public.image_generations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  prompt     text not null,
  model      text,
  image_url  text,
  status     text not null default 'pending',
  credits    numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.image_generations enable row level security;

drop policy if exists "image_generations_select_own" on public.image_generations;
create policy "image_generations_select_own" on public.image_generations
  for select using (auth.uid() = user_id);

drop policy if exists "image_generations_insert_own" on public.image_generations;
create policy "image_generations_insert_own" on public.image_generations
  for insert with check (auth.uid() = user_id);

drop policy if exists "image_generations_update_own" on public.image_generations;
create policy "image_generations_update_own" on public.image_generations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "image_generations_delete_own" on public.image_generations;
create policy "image_generations_delete_own" on public.image_generations
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- chat_conversations (P5): conversas do playground.
-- -----------------------------------------------------------------------------
create table if not exists public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  model      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;

drop policy if exists "chat_conversations_select_own" on public.chat_conversations;
create policy "chat_conversations_select_own" on public.chat_conversations
  for select using (auth.uid() = user_id);

drop policy if exists "chat_conversations_insert_own" on public.chat_conversations;
create policy "chat_conversations_insert_own" on public.chat_conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "chat_conversations_update_own" on public.chat_conversations;
create policy "chat_conversations_update_own" on public.chat_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat_conversations_delete_own" on public.chat_conversations;
create policy "chat_conversations_delete_own" on public.chat_conversations
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- chat_messages (P5): mensagens das conversas. FK cascade em conversation.
-- RLS por user_id = auth.uid() (o dono da mensagem).
-- -----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own" on public.chat_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- model_news (P3B): feed de notícias de modelos (conteúdo público-de-leitura).
-- RLS: SELECT liberado a usuários autenticados; INSERT/UPDATE só service-role
-- (o agregador/cron escreve com a service-role key). Sem policy de write => o
-- RLS bloqueia qualquer write de anon/authenticated.
-- -----------------------------------------------------------------------------
create table if not exists public.model_news (
  id           uuid primary key default gen_random_uuid(),
  source       text,
  title        text not null,
  url          text,
  summary      text,
  image_url    text,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.model_news enable row level security;

drop policy if exists "model_news_select_authenticated" on public.model_news;
create policy "model_news_select_authenticated" on public.model_news
  for select to authenticated using (true);

-- Blindagem extra a nível de GRANT (além da RLS): ninguém que não seja
-- service-role pode inserir/atualizar/deletar model_news.
revoke insert, update, delete on public.model_news from anon, authenticated;
grant select on public.model_news to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: model_selection entra na publicação supabase_realtime para o
-- desktop assinar postgres_changes. replica identity full para os eventos de
-- UPDATE/DELETE carregarem a linha antiga (o RLS segue valendo por assinante).
-- -----------------------------------------------------------------------------
alter table public.model_selection replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'model_selection'
  ) then
    alter publication supabase_realtime add table public.model_selection;
  end if;
end $$;
