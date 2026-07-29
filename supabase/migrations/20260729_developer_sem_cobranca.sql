-- Developer não é cobrado, mas É medido.
--
-- "Ilimitado" e "invisível" são coisas diferentes. Dar saldo infinito à equipe
-- resolveria o bloqueio e apagaria o custo real de vista — exatamente o número
-- que o painel interno existe para mostrar. Então: o débito é pulado, o registro
-- não.
--
-- O bypass mora NAS RPCs, e não nas rotas, porque chat, imagem e vídeo passam
-- todos por `hold_credits`/`settle_hold`. Espalhar `if developer` por rota seria
-- garantir que a próxima rota nasça cobrando da equipe.
--
-- No `usage_log` do developer: `credits = 0` (não contamina receita nem saldo),
-- `meta.cost_usd` com o custo real em dólar, `meta.internal = true` e
-- `meta.would_charge_credits` com o que teria sido cobrado de um cliente.
--
-- Verificado com o saldo ZERADO — um teste com saldo cheio passaria mesmo sem o
-- bypass e não provaria nada:
--   hold com saldo 0        → passou
--   créditos debitados      → 0
--   usage_log.cost_usd      → 1,75
--   usage_log.internal      → true
--   would_charge_credits    → 37,32
--   saldo depois            → inalterado
--
-- O corpo das funções está na migration aplicada em 29/07/2026
-- (`developer_sem_cobranca_com_registro`); este arquivo registra a decisão e o
-- teste. A função auxiliar:

create or replace function public.is_developer(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select role = 'developer' from public.profiles where id = p_user), false)
$$;

comment on function public.is_developer(uuid) is
  'Papel developer (equipe interna). Usado por hold_credits/settle_hold para não cobrar — mas o uso continua sendo REGISTRADO.';
