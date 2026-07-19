-- =============================================================================
-- Rate limiting por usuário sem Redis/Upstash (Fase 3).
--
-- Contador de janela (fixed-window) no Postgres + RPC atômica `rate_limit_hit`.
-- Chamada SÓ pela service-role a partir das rotas edge (proxy de chat, imagens,
-- refresh de notícias), com o user id já verificado do JWT.
--
-- Idempotente. NÃO aplicar automaticamente — revisar e aplicar manualmente.
-- =============================================================================

create table if not exists public.rate_limit_counters (
  user_id      uuid not null,
  bucket       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.rate_limit_counters enable row level security;
-- Sem policies: acesso só via service-role / RPC SECURITY DEFINER. O browser
-- nunca toca esta tabela.
revoke all on public.rate_limit_counters from anon, authenticated;

-- Registra 1 hit na janela atual e devolve se está dentro do limite.
-- Retorno: { allowed, remaining, limit, reset_at }.
create or replace function public.rate_limit_hit(
  p_user uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (user_id, bucket, window_start, count)
  values (p_user, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.rate_limit_counters.count + 1
  returning count into v_count;

  -- Limpeza barata: descarta janelas antigas deste (user, bucket).
  delete from public.rate_limit_counters
  where user_id = p_user and bucket = p_bucket and window_start < v_window_start;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'limit', p_limit,
    'reset_at', to_jsonb(v_window_start + make_interval(secs => p_window_seconds))
  );
end;
$$;

revoke all on function public.rate_limit_hit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(uuid, text, integer, integer) to service_role;
