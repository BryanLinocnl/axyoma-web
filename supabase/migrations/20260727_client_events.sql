-- Telemetria escrita pelo CLIENTE (app desktop), em domínio de confiança próprio.
--
-- Contexto: com o BYOK falando direto com o provider, o proxy sai do caminho e a
-- linha que `logByokUsage` gravava em `usage_log` deixa de existir. Sem
-- substituto, o produto fica cego na métrica de usuários ativos.
--
-- REGRA CENTRAL (spec proxy-direto-provider.md, R3): dado escrito pelo cliente é
-- NÃO-CONFIÁVEL por construção e nunca toca o razão de cobrança. Por isso esta
-- tabela é SEPARADA de `usage_log`/`credits`/`credit_holds`, que continuam
-- exclusivos do service role.
--
-- Não existe coluna monetária aqui, de propósito: o USD é sempre derivado no
-- servidor a partir de `public.models.*_price_usd_per_mtok`. O cliente informa
-- contagem de token e id de modelo — fatos que não tem interesse em falsificar —
-- e nunca informa dinheiro.
--
-- O cliente NÃO recebe INSERT nesta tabela. A única porta de escrita é a função
-- `log_client_event`, que força `user_id` e `ts`, valida domínio, trunca strings,
-- limita números e aplica rate limit.

create table if not exists public.client_events (
  id                 bigserial primary key,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  -- Sempre do servidor. A RPC não aceita data do cliente: senão dá para datar
  -- evento no passado/futuro e envenenar qualquer série temporal.
  ts                 timestamptz not null default now(),
  kind               text        not null,

  -- Volume ------------------------------------------------------------------
  provider           text,
  model_id           text,
  prompt_tokens      integer     not null default 0 check (prompt_tokens     >= 0),
  completion_tokens  integer     not null default 0 check (completion_tokens >= 0),
  cached_tokens      integer     not null default 0 check (cached_tokens     >= 0),
  reasoning_tokens   integer     not null default 0 check (reasoning_tokens  >= 0),

  -- Qualidade ---------------------------------------------------------------
  ttft_ms            integer     check (ttft_ms     is null or ttft_ms     >= 0),
  duration_ms        integer     check (duration_ms is null or duration_ms >= 0),
  outcome            text        check (outcome     is null or outcome     in ('ok','error','aborted','cap')),
  -- SEMPRE classificado, NUNCA a mensagem crua do upstream: ela pode carregar
  -- pedaço do prompt do usuário.
  error_class        text        check (error_class is null or error_class in
                                   ('rate_limit','context_length','upstream_5xx',
                                    'upstream_4xx','tool_parse','network','other')),
  iterations         integer     not null default 0 check (iterations        >= 0),
  tool_calls_total   integer     not null default 0 check (tool_calls_total  >= 0),
  tool_calls_failed  integer     not null default 0 check (tool_calls_failed >= 0),

  -- Perfil de workload ------------------------------------------------------
  mode               text        check (mode           is null or mode           in ('code','plan','design')),
  -- Faixa, não valor exato: o tamanho exato de contexto é assinatura do projeto.
  context_bucket     text        check (context_bucket is null or context_bucket in ('<32k','32-128k','128-512k','>512k')),
  -- Só NOMES de ferramenta. Argumento carrega caminho e conteúdo — nunca entra.
  tools_used         text[]      not null default '{}',
  lang               text,
  lines_added        integer     not null default 0 check (lines_added   >= 0),
  lines_removed      integer     not null default 0 check (lines_removed >= 0),
  -- UUID ALEATÓRIO gerado na máquina, jamais derivado de nome ou caminho: hash
  -- de nome é reversível por dicionário e fica colado ao conteúdo real.
  project_ref        uuid,

  -- Contexto ----------------------------------------------------------------
  app_version        text,
  os                 text,
  session_id         uuid,

  -- Reservado ao SERVIDOR (service role). A RPC não expõe este campo: um jsonb
  -- livre escrito pelo cliente é o caminho mais fácil para conteúdo de usuário
  -- vazar para cá. Campo novo no futuro = coluna nova, não chave em jsonb.
  meta               jsonb       not null default '{}'::jsonb
);

-- Leitura do dono + janela do rate limit da RPC.
create index if not exists client_events_user_ts_idx on public.client_events (user_id, ts desc);
-- Rollups de mercado (por modelo/período).
create index if not exists client_events_model_ts_idx on public.client_events (model_id, ts);

alter table public.client_events enable row level security;

-- Dono lê o que é dele. Nada mais.
drop policy if exists "client_events owner read" on public.client_events;
create policy "client_events owner read" on public.client_events
  for select using (user_id = auth.uid());

-- SEM policy de insert/update/delete: escrita só pela RPC security definer.
-- O revoke é o que impede o cliente de contornar a validação escrevendo direto.
revoke insert, update, delete on public.client_events from anon, authenticated;
revoke all on sequence public.client_events_id_seq from anon, authenticated;


-- -----------------------------------------------------------------------------
-- Única porta de escrita.
--
-- security definer para poder inserir numa tabela onde `authenticated` não tem
-- INSERT. `auth.uid()` continua valendo aqui: ele lê o claim do JWT da
-- requisição, não o usuário do banco.
--
-- search_path fixo: sem isso, security definer é vetor clássico de escalonamento
-- (o chamador aponta o search_path para um schema dele e sequestra as funções).
-- -----------------------------------------------------------------------------
create or replace function public.log_client_event(
  p_kind              text,
  p_provider          text    default null,
  p_model_id          text    default null,
  p_prompt_tokens     integer default 0,
  p_completion_tokens integer default 0,
  p_cached_tokens     integer default 0,
  p_reasoning_tokens  integer default 0,
  p_ttft_ms           integer default null,
  p_duration_ms       integer default null,
  p_outcome           text    default null,
  p_error_class       text    default null,
  p_iterations        integer default 0,
  p_tool_calls_total  integer default 0,
  p_tool_calls_failed integer default 0,
  p_mode              text    default null,
  p_context_bucket    text    default null,
  p_tools_used        text[]  default '{}',
  p_lang              text    default null,
  p_lines_added       integer default 0,
  p_lines_removed     integer default 0,
  p_project_ref       uuid    default null,
  p_app_version       text    default null,
  p_os                text    default null,
  p_session_id        uuid    default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   uuid;
  v_recent integer;
  -- Teto por minuto e por usuário. Um turno de agente emite UM evento, então
  -- 120/min é folga larga para uso legítimo e ainda barra inundação — o Free do
  -- Supabase tem 500 MB no total.
  c_limit  constant integer := 120;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('byok_turn','byok_error','app_error','session_start') then
    raise exception 'kind inválido: %', p_kind using errcode = '22023';
  end if;

  select count(*) into v_recent
  from public.client_events
  where user_id = v_user and ts > now() - interval '1 minute';

  if v_recent >= c_limit then
    raise exception 'rate limit de telemetria excedido' using errcode = '53400';
  end if;

  insert into public.client_events (
    user_id, kind, provider, model_id,
    prompt_tokens, completion_tokens, cached_tokens, reasoning_tokens,
    ttft_ms, duration_ms, outcome, error_class,
    iterations, tool_calls_total, tool_calls_failed,
    mode, context_bucket, tools_used, lang,
    lines_added, lines_removed, project_ref,
    app_version, os, session_id
  ) values (
    v_user,                       -- do JWT, NUNCA de parâmetro
    p_kind,
    left(p_provider, 64),
    left(p_model_id, 128),
    -- clamp: valor negativo ou absurdo não deforma agregado nem estoura o int4
    least(greatest(coalesce(p_prompt_tokens,     0), 0), 1000000000),
    least(greatest(coalesce(p_completion_tokens, 0), 0), 1000000000),
    least(greatest(coalesce(p_cached_tokens,     0), 0), 1000000000),
    least(greatest(coalesce(p_reasoning_tokens,  0), 0), 1000000000),
    least(greatest(p_ttft_ms,     0), 3600000),
    least(greatest(p_duration_ms, 0), 86400000),
    p_outcome,                    -- domínio garantido pelo CHECK da tabela
    p_error_class,
    least(greatest(coalesce(p_iterations,        0), 0), 100000),
    least(greatest(coalesce(p_tool_calls_total,  0), 0), 100000),
    least(greatest(coalesce(p_tool_calls_failed, 0), 0), 100000),
    p_mode,
    p_context_bucket,
    -- no máximo 32 nomes, 64 chars cada: corta tentativa de usar o array como
    -- campo de texto livre.
    coalesce((select array_agg(left(t, 64)) from unnest(p_tools_used[1:32]) as t), '{}'),
    left(p_lang, 32),
    least(greatest(coalesce(p_lines_added,   0), 0), 100000000),
    least(greatest(coalesce(p_lines_removed, 0), 0), 100000000),
    p_project_ref,
    left(p_app_version, 32),
    left(p_os, 32),
    p_session_id
  );
end;
$$;

revoke all on function public.log_client_event(
  text, text, text, integer, integer, integer, integer, integer, integer,
  text, text, integer, integer, integer, text, text, text[], text,
  integer, integer, uuid, text, text, uuid
) from public, anon;

grant execute on function public.log_client_event(
  text, text, text, integer, integer, integer, integer, integer, integer,
  text, text, integer, integer, integer, text, text, text[], text,
  integer, integer, uuid, text, text, uuid
) to authenticated;

comment on table public.client_events is
  'Telemetria escrita pelo app. NÃO-CONFIÁVEL: nunca usar para cobrança, '
  'conciliação ou qualquer decisão monetária. Razão de cobrança é usage_log.';
