-- Rollup diário + retenção da telemetria.
--
-- POR QUÊ AGORA: `usage_log` cresce sem poda desde sempre (428 B/linha medidos),
-- e `client_events` passa a somar junto. Os 500 MB do plano Free comportam
-- ~1,17M linhas; a 100 usuários são ~420k linhas/mês. O banco enche em menos de
-- três meses. O agregado, esse cabe para sempre.
--
-- DUAS FONTES, UMA TABELA, SEM MISTURAR: `fonte` separa o que veio do proxy
-- (autoritativo, é razão de cobrança) do que veio do cliente (não-confiável).
-- Elas convivem na mesma tabela para o painel ser uma consulta só, mas QUALQUER
-- métrica de receita filtra `fonte = 'proxy'`. Somar as duas seria deixar o
-- usuário escrever no próprio faturamento pela porta dos fundos.
--
-- O QUE ESTA MIGRATION NÃO FAZ: apagar `usage_log`. Ver comentário no agendamento.

create table if not exists public.usage_daily (
  dia               date    not null,
  user_id           uuid    not null,
  -- 'proxy'  = derivado de usage_log. Autoritativo.
  -- 'client' = derivado de client_events. NÃO-CONFIÁVEL.
  fonte             text    not null check (fonte in ('proxy','client')),
  kind              text    not null default '',
  provider          text    not null default '',
  model             text    not null default '',

  calls             integer not null default 0,
  prompt_tokens     bigint  not null default 0,
  completion_tokens bigint  not null default 0,
  cached_tokens     bigint  not null default 0,

  -- Crédito só existe na fonte 'proxy'. Em 'client' é sempre 0, por construção:
  -- o cliente não informa dinheiro.
  credits           numeric not null default 0,
  -- USD. Em 'proxy' vem do que foi realmente cobrado; em 'client' é DERIVADO
  -- aqui, no servidor, a partir da tabela `models`.
  cost_usd          numeric not null default 0,

  -- Qualidade e volume de trabalho (só fonte 'client').
  iterations        bigint  not null default 0,
  tool_calls_total  bigint  not null default 0,
  tool_calls_failed bigint  not null default 0,
  lines_added       bigint  not null default 0,
  lines_removed     bigint  not null default 0,
  duration_ms_sum   bigint  not null default 0,
  ttft_ms_sum       bigint  not null default 0,
  ttft_amostras     integer not null default 0,

  atualizado_em     timestamptz not null default now(),

  primary key (dia, user_id, fonte, kind, provider, model)
);

create index if not exists usage_daily_dia_idx on public.usage_daily (dia desc);
create index if not exists usage_daily_model_idx on public.usage_daily (model, dia desc);

alter table public.usage_daily enable row level security;
drop policy if exists "usage_daily owner read" on public.usage_daily;
create policy "usage_daily owner read" on public.usage_daily
  for select using (user_id = auth.uid());
revoke insert, update, delete on public.usage_daily from anon, authenticated;


-- -----------------------------------------------------------------------------
-- Rollup. Idempotente de propósito: reprocessa os últimos N dias e sobrescreve.
-- Linha que chega atrasada (fila de telemetria drenando depois) entra na próxima
-- passada sem duplicar.
-- -----------------------------------------------------------------------------
create or replace function public.rollup_usage_daily(p_dias integer default 3)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date := (now() - make_interval(days => greatest(p_dias, 1)))::date;
  v_n     integer := 0;
begin
  -- ── Fonte 'proxy' (usage_log) ──────────────────────────────────────────────
  insert into public.usage_daily (
    dia, user_id, fonte, kind, provider, model,
    calls, prompt_tokens, completion_tokens, cached_tokens, credits, cost_usd,
    atualizado_em
  )
  select
    (u.ts at time zone 'UTC')::date,
    u.user_id,
    'proxy',
    coalesce(u.kind, ''),
    coalesce(u.meta->>'provider', ''),
    coalesce(u.model, ''),
    count(*),
    coalesce(sum(u.prompt_tokens), 0),
    coalesce(sum(u.completion_tokens), 0),
    0,
    coalesce(sum(u.credits), 0),
    coalesce(sum((u.meta->>'cost_usd')::numeric), 0),
    now()
  from public.usage_log u
  where u.ts >= v_desde
  group by 1, 2, 4, 5, 6
  on conflict (dia, user_id, fonte, kind, provider, model) do update set
    calls             = excluded.calls,
    prompt_tokens     = excluded.prompt_tokens,
    completion_tokens = excluded.completion_tokens,
    credits           = excluded.credits,
    cost_usd          = excluded.cost_usd,
    atualizado_em     = now();

  get diagnostics v_n = row_count;

  -- ── Fonte 'client' (client_events) ─────────────────────────────────────────
  -- O USD é calculado AQUI, no servidor, a partir de `models`. O cliente manda
  -- id de modelo e contagem de token; nunca dinheiro. Modelo desconhecido no
  -- catálogo (BYOK pode apontar para qualquer coisa) fica com custo 0 em vez de
  -- inventar número.
  insert into public.usage_daily (
    dia, user_id, fonte, kind, provider, model,
    calls, prompt_tokens, completion_tokens, cached_tokens, cost_usd,
    iterations, tool_calls_total, tool_calls_failed,
    lines_added, lines_removed, duration_ms_sum, ttft_ms_sum, ttft_amostras,
    atualizado_em
  )
  select
    (c.ts at time zone 'UTC')::date,
    c.user_id,
    'client',
    c.kind,
    coalesce(c.provider, ''),
    coalesce(c.model_id, ''),
    count(*),
    coalesce(sum(c.prompt_tokens), 0),
    coalesce(sum(c.completion_tokens), 0),
    coalesce(sum(c.cached_tokens), 0),
    coalesce(sum(
      (greatest(c.prompt_tokens - c.cached_tokens, 0) / 1e6) * coalesce(m.input_price_usd_per_mtok, 0)
      + (c.cached_tokens / 1e6) * coalesce(m.cached_input_price_usd_per_mtok, m.input_price_usd_per_mtok, 0)
      + (c.completion_tokens / 1e6) * coalesce(m.output_price_usd_per_mtok, 0)
    ), 0),
    coalesce(sum(c.iterations), 0),
    coalesce(sum(c.tool_calls_total), 0),
    coalesce(sum(c.tool_calls_failed), 0),
    coalesce(sum(c.lines_added), 0),
    coalesce(sum(c.lines_removed), 0),
    coalesce(sum(c.duration_ms), 0),
    coalesce(sum(c.ttft_ms), 0),
    count(c.ttft_ms),
    now()
  from public.client_events c
  left join public.models m on m.id = c.model_id
  where c.ts >= v_desde
  group by 1, 2, 4, 5, 6
  on conflict (dia, user_id, fonte, kind, provider, model) do update set
    calls             = excluded.calls,
    prompt_tokens     = excluded.prompt_tokens,
    completion_tokens = excluded.completion_tokens,
    cached_tokens     = excluded.cached_tokens,
    cost_usd          = excluded.cost_usd,
    iterations        = excluded.iterations,
    tool_calls_total  = excluded.tool_calls_total,
    tool_calls_failed = excluded.tool_calls_failed,
    lines_added       = excluded.lines_added,
    lines_removed     = excluded.lines_removed,
    duration_ms_sum   = excluded.duration_ms_sum,
    ttft_ms_sum       = excluded.ttft_ms_sum,
    ttft_amostras     = excluded.ttft_amostras,
    atualizado_em     = now();

  return v_n;
end;
$$;

revoke all on function public.rollup_usage_daily(integer) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Retenção do BRUTO de telemetria.
--
-- Só `client_events`. É telemetria pura, sem valor monetário e sem valor
-- probatório: depois de agregada, a linha crua não serve para mais nada.
--
-- Nunca apaga sem ter agregado antes — daí o rollup ser chamado aqui dentro,
-- com uma janela larga o bastante para cobrir a fila do app drenando atrasada.
-- -----------------------------------------------------------------------------
create or replace function public.purge_client_events(p_dias integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  perform public.rollup_usage_daily(greatest(p_dias, 1) + 2);
  delete from public.client_events
   where ts < now() - make_interval(days => greatest(p_dias, 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.purge_client_events(integer) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Agendamento (pg_cron, dentro do próprio Postgres).
--
-- NÃO usa o cron da Vercel de propósito: seria gastar invocação e transferência
-- para um trabalho que é do banco e nunca sai dele.
--
-- ATENÇÃO — o que NÃO está agendado, e é decisão do produto, não técnica:
-- não existe purga de `usage_log`. Ele é a razão de cobrança: é o que responde
-- "por que fui cobrado R$ X" numa disputa, e no Brasil documento fiscal tem
-- prazo de guarda em anos, não em meses. Apagar isso automaticamente seria uma
-- decisão jurídica tomada por uma migration.
--
-- O problema de espaço é real e tem prazo: a 100 usuários são ~420k linhas/mês
-- (~180 MB), e o plano Free tem 500 MB no total. Quando apertar, as saídas são
-- Supabase Pro (8 GB) ou exportar o bruto antigo para fora antes de apagar. O
-- agregado em `usage_daily` já sobrevive aos dois caminhos.
-- -----------------------------------------------------------------------------
select cron.unschedule('rollup_usage_daily')
  where exists (select 1 from cron.job where jobname = 'rollup_usage_daily');
select cron.schedule('rollup_usage_daily', '20 5 * * *', $cron$select public.rollup_usage_daily(3)$cron$);

select cron.unschedule('purge_client_events')
  where exists (select 1 from cron.job where jobname = 'purge_client_events');
select cron.schedule('purge_client_events', '50 5 * * *', $cron$select public.purge_client_events(90)$cron$);

comment on table public.usage_daily is
  'Agregado diário. `fonte`=proxy é autoritativo (razão de cobrança); '
  'fonte=client vem do app e é NÃO-CONFIÁVEL. Métrica de receita filtra proxy.';
