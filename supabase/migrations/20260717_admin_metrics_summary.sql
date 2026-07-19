-- Painel developer: função RPC única que agrega métricas globais (todos os
-- usuários). Chamada só pela service-role key (proxy server-side), nunca
-- exposta a anon/authenticated diretamente.
create or replace function admin_metrics_summary()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'total_purchased_credits', (select coalesce(sum(total_purchased), 0) from credits),
    'total_balance_credits', (select coalesce(sum(balance), 0) from credits),
    'active_subscriptions', (select count(*) from subscriptions where status = 'active'),
    'spend_today_credits', (select coalesce(sum(credits), 0) from usage_log where ts >= date_trunc('day', now())),
    'spend_7d_credits', (select coalesce(sum(credits), 0) from usage_log where ts >= now() - interval '7 days'),
    'spend_30d_credits', (select coalesce(sum(credits), 0) from usage_log where ts >= now() - interval '30 days'),
    'by_model_30d', (
      select coalesce(json_agg(t), '[]'::json) from (
        select
          model,
          count(*) as calls,
          sum(credits) as credits,
          sum(prompt_tokens) as prompt_tokens,
          sum(completion_tokens) as completion_tokens
        from usage_log
        where ts >= now() - interval '30 days'
        group by model
        order by sum(credits) desc
        limit 20
      ) t
    ),
    'daily_30d', (
      select coalesce(json_agg(t), '[]'::json) from (
        select
          date_trunc('day', ts)::date as day,
          sum(credits) as credits,
          count(*) as calls
        from usage_log
        where ts >= now() - interval '30 days'
        group by 1
        order by 1
      ) t
    )
  );
$$;

revoke all on function admin_metrics_summary() from public, anon, authenticated;
grant execute on function admin_metrics_summary() to service_role;
