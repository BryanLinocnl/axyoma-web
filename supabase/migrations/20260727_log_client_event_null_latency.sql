-- Correção: latência AUSENTE virava 0 em vez de continuar nula.
--
-- `greatest(null, 0)` no Postgres devolve 0 — as funções `greatest`/`least`
-- IGNORAM NULL e retornam o maior/menor entre os não-nulos. Não é como o
-- aritmético, onde qualquer operando nulo propaga nulo. Então
-- `least(greatest(p_ttft_ms,0),3600000)` transformava silenciosamente "não medi"
-- em "mediu zero".
--
-- Apareceu no primeiro turno real: um erro que falhou antes de qualquer chunk
-- gravou `ttft_ms = 0`. Zero e "não houve" são coisas diferentes, e a diferença
-- importa: TTFT é uma das métricas de comparação de latência entre modelos, e um
-- monte de zeros falsos puxa qualquer média para baixo.
--
-- O saneamento de valor PRESENTE continua igual: negativo vira 0, excesso vira
-- teto. Só o caso nulo passa a ser preservado.
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
    v_user,
    p_kind,
    left(p_provider, 64),
    left(p_model_id, 128),
    least(greatest(coalesce(p_prompt_tokens,     0), 0), 1000000000),
    least(greatest(coalesce(p_completion_tokens, 0), 0), 1000000000),
    least(greatest(coalesce(p_cached_tokens,     0), 0), 1000000000),
    least(greatest(coalesce(p_reasoning_tokens,  0), 0), 1000000000),
    -- NULO preservado; presente é saneado.
    case when p_ttft_ms     is null then null else least(greatest(p_ttft_ms,     0), 3600000)  end,
    case when p_duration_ms is null then null else least(greatest(p_duration_ms, 0), 86400000) end,
    p_outcome,
    p_error_class,
    least(greatest(coalesce(p_iterations,        0), 0), 100000),
    least(greatest(coalesce(p_tool_calls_total,  0), 0), 100000),
    least(greatest(coalesce(p_tool_calls_failed, 0), 0), 100000),
    p_mode,
    p_context_bucket,
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

-- Corrige o dado já gravado: o único 0 existente veio deste bug (turno que
-- falhou antes de qualquer chunk), não de uma medição real de zero.
update public.client_events set ttft_ms = null where ttft_ms = 0 and outcome = 'error';
