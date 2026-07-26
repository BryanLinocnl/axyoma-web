-- =============================================================================
-- Bônus de cadastro vira um POTE SEPARADO, restrito aos modelos Vertex.
--
-- PROBLEMA: `grant_signup_bonus` somava em `credits.balance` e `hold_credits` só
-- mexia em `balance`. Bônus e crédito comprado eram o mesmo dinheiro — o bônus
-- de boas-vindas era gastável em qualquer modelo, inclusive nos que a gente paga
-- caro à OpenRouter.
--
-- DEPOIS DESTA MIGRATION:
--   * `credits.bonus_balance` = franquia de cadastro. Só sai em requisição que o
--     proxy marcar como Vertex (`p_allow_bonus = true`).
--   * `credits.balance` = crédito comprado. Sai em qualquer modelo.
--   * Ordem de consumo quando os dois valem: BÔNUS PRIMEIRO. A franquia só serve
--     para Vertex; deixá-la parada enquanto o crédito comprado é queimado seria
--     desperdiçar o dinheiro do usuário.
--
-- ⚠️ ORDEM DE IMPLANTAÇÃO: esta migration vem ANTES do código que lê
-- `bonus_balance` e que passa `p_allow_bonus`. O `getBalances` do web foi
-- escrito tolerante (RPC ausente → bônus 0), então a janela entre um e outro não
-- derruba tela; mas o proxy só passa a respeitar a restrição com as duas pontas
-- no ar.
--
-- Idempotente. APLICADA em 2026-07-25.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------------

-- Nasce NULLABLE de propósito: o NULL é o marcador de "ainda não backfillado" e
-- é o que torna esta migration segura de rodar duas vezes. Vira NOT NULL no fim.
alter table public.credits
  add column if not exists bonus_balance numeric;

-- Quanto de cada pote foi reservado por um hold. Sem isto o settle não tem como
-- devolver o troco ao pote de origem — e é aí que bug vira dinheiro perdido
-- (usuário) ou dinheiro de graça (nós).
alter table public.credit_holds
  add column if not exists held_bonus numeric not null default 0;
alter table public.credit_holds
  add column if not exists held_balance numeric not null default 0;

-- O hold guarda se ele PODIA usar bônus. Não dá para inferir de `held_bonus > 0`:
-- um hold Vertex feito com o pote de bônus zerado reservaria 0 de bônus e, no
-- settle, o custo excedente cairia no crédito comprado mesmo se o bônus tivesse
-- sido recarregado no meio. A intenção precisa estar gravada, não deduzida.
alter table public.credit_holds
  add column if not exists allow_bonus boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) Backfill
-- ---------------------------------------------------------------------------
-- Move o bônus concedido de `balance` para `bonus_balance`, LIMITADO ao saldo
-- atual: quem já gastou parte do bônus não pode ganhar crédito de volta.
--
-- O valor concedido vem do `usage_log` (kind = 'signup_bonus'). Atenção ao sinal:
-- aquela linha grava `credits = -p_credits`, e `meta.granted_credits` guarda o
-- valor positivo. Usamos o meta e caímos em `-credits` se ele faltar.
update public.credits c
   set bonus_balance = least(g.bonus, greatest(c.balance, 0)),
       balance       = c.balance - least(g.bonus, greatest(c.balance, 0)),
       updated_at    = now()
  from (
    select user_id,
           sum(coalesce(nullif(meta->>'granted_credits', '')::numeric, -credits)) as bonus
      from public.usage_log
     where kind = 'signup_bonus'
     group by user_id
  ) g
 where g.user_id = c.user_id
   and c.bonus_balance is null;   -- só na primeira passada

-- Quem nunca recebeu bônus (ou linha nova) fecha em 0.
update public.credits set bonus_balance = 0 where bonus_balance is null;

alter table public.credits alter column bonus_balance set default 0;
alter table public.credits alter column bonus_balance set not null;

-- ---------------------------------------------------------------------------
-- 3) Clamp: o mesmo piso que `balance` já tinha
-- ---------------------------------------------------------------------------
-- Mantém o comportamento existente (saldo nunca fica negativo na tabela) agora
-- também para o bônus. É rede de segurança, não regra de negócio: as guardas do
-- `hold_credits` já impedem reservar mais do que existe.
create or replace function public.clamp_credit_balance()
returns trigger
language plpgsql
as $$
begin
  if new.balance < 0 then
    new.balance := 0;
  end if;
  if new.bonus_balance < 0 then
    new.bonus_balance := 0;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Concessão do bônus vai para o pote novo
-- ---------------------------------------------------------------------------
create or replace function public.grant_signup_bonus(p_user uuid, p_credits numeric)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bonus numeric;
begin
  if p_user is null then raise exception 'usuário ausente'; end if;
  if p_credits is null or p_credits < 0 then raise exception 'bônus inválido'; end if;

  -- A guarda `signup_bonus_granted_at is null` continua sendo o que impede
  -- bônus duplicado. Não mexer.
  update public.credits
     set bonus_balance = bonus_balance + p_credits,
         signup_bonus_granted_at = now(),
         updated_at = now()
   where user_id = p_user
     and signup_bonus_granted_at is null
  returning bonus_balance into v_bonus;

  if found then
    insert into public.usage_log (user_id, kind, model, prompt_tokens, completion_tokens, credits, meta)
    values (p_user, 'signup_bonus', null, 0, 0, -p_credits,
            jsonb_build_object('via', 'proxy', 'granted_credits', p_credits, 'bucket', 'bonus'));
    return v_bonus;
  end if;

  select bonus_balance into v_bonus from public.credits where user_id = p_user;
  return coalesce(v_bonus, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Reserva: bônus primeiro quando permitido
-- ---------------------------------------------------------------------------
-- Assinatura ganha `p_allow_bonus` com DEFAULT false. Fail-closed de propósito:
-- um chamador que ainda não foi atualizado passa a NÃO tocar no bônus, o que é
-- o lado seguro do erro (no máximo cobra do pote errado a favor do usuário,
-- nunca libera a franquia num modelo que não é Vertex).
create or replace function public.hold_credits(
  p_user        uuid,
  p_credits     numeric,
  p_kind        text default 'chat',
  p_model       text default null,
  p_allow_bonus boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hold         uuid;
  v_bonus        numeric;
  v_from_bonus   numeric;
  v_from_balance numeric;
begin
  if p_user is null then raise exception 'usuário ausente'; end if;
  if p_credits is null or p_credits < 0 then raise exception 'reserva inválida'; end if;

  perform public.release_stale_holds(p_user);

  -- FOR UPDATE trava a linha: requisições concorrentes serializam aqui em vez de
  -- lerem o mesmo saldo e passarem todas. (Antes a atomicidade vinha só do
  -- `where balance >= …`; com dois potes a decisão de QUANTO tirar de cada um
  -- precisa ser tomada sob o lock, senão o split pode ser calculado sobre um
  -- bônus que outra requisição já consumiu.)
  select bonus_balance into v_bonus
    from public.credits
   where user_id = p_user
     for update;

  if not found then
    raise exception 'saldo insuficiente' using errcode = 'P0001';
  end if;

  if coalesce(p_allow_bonus, false) then
    v_from_bonus := least(p_credits, greatest(coalesce(v_bonus, 0), 0));
  else
    v_from_bonus := 0;
  end if;
  v_from_balance := p_credits - v_from_bonus;

  update public.credits
     set bonus_balance = bonus_balance - v_from_bonus,
         balance       = balance - v_from_balance,
         updated_at    = now()
   where user_id = p_user
     and balance       >= v_from_balance
     and bonus_balance >= v_from_bonus;

  if not found then
    raise exception 'saldo insuficiente' using errcode = 'P0001';
  end if;

  insert into public.credit_holds (user_id, credits, kind, model, held_bonus, held_balance, allow_bonus)
  values (p_user, p_credits, coalesce(p_kind, 'chat'), p_model,
          v_from_bonus, v_from_balance, coalesce(p_allow_bonus, false))
  returning id into v_hold;

  return v_hold;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Liquidação: devolve a reserva inteira, depois cobra o custo real
-- ---------------------------------------------------------------------------
-- MODELO EM DOIS PASSOS, de propósito. A alternativa (calcular deltas por pote
-- em cima da reserva) precisa de um caso especial para cada situação: custo
-- menor que a parte de bônus, custo entre as duas partes, custo MAIOR que a
-- reserva inteira (estouro). Devolver tudo e recobrar trata os três com o mesmo
-- código, e o estouro sai do pote certo em vez de sempre do crédito comprado.
-- É uma função plpgsql — os dois passos são uma transação só.
create or replace function public.settle_hold(
  p_hold             uuid,
  p_cost_usd         numeric,
  p_model            text default null,
  p_prompt_tokens    integer default null,
  p_completion_tokens integer default null,
  p_meta             jsonb default null,
  p_margin_override  numeric default null
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hold        public.credit_holds%rowtype;
  v_cfg         public.billing_config%rowtype;
  v_margin      numeric;
  v_credits     numeric;
  v_bonus       numeric;
  v_use_bonus   numeric;
  v_use_balance numeric;
begin
  select * into v_hold from public.credit_holds where id = p_hold for update;
  if not found then raise exception 'hold inexistente'; end if;

  -- Já liquidado: devolve o que foi cobrado, sem cobrar de novo.
  if v_hold.status <> 'open' then
    return coalesce(
      (select credits from public.usage_log
        where meta->>'hold_id' = p_hold::text
        order by ts desc limit 1),
      0
    );
  end if;

  select * into v_cfg from public.billing_config limit 1;
  if not found then raise exception 'billing_config ausente'; end if;

  if p_margin_override is not null and p_margin_override >= 0 then
    v_margin := p_margin_override;
  else
    v_margin := v_cfg.margin_multiplier;
  end if;

  v_credits := round(coalesce(p_cost_usd, 0) * v_cfg.usd_brl_rate * v_margin / v_cfg.credit_brl, 6);

  -- PASSO 1: desfaz a reserva, cada parte no seu pote.
  update public.credits
     set bonus_balance = bonus_balance + v_hold.held_bonus,
         balance       = balance + v_hold.held_balance,
         updated_at    = now()
   where user_id = v_hold.user_id;

  -- PASSO 2: cobra o custo real. Bônus primeiro se o hold permitia bônus.
  select bonus_balance into v_bonus
    from public.credits
   where user_id = v_hold.user_id
     for update;

  if coalesce(v_hold.allow_bonus, false) then
    v_use_bonus := least(v_credits, greatest(coalesce(v_bonus, 0), 0));
  else
    v_use_bonus := 0;
  end if;
  v_use_balance := v_credits - v_use_bonus;

  update public.credits
     set bonus_balance = bonus_balance - v_use_bonus,
         balance       = balance - v_use_balance,
         updated_at    = now()
   where user_id = v_hold.user_id;

  insert into public.usage_log (user_id, kind, model, prompt_tokens, completion_tokens, credits, meta)
  values (
    v_hold.user_id, 'openrouter', coalesce(p_model, v_hold.model),
    coalesce(p_prompt_tokens, 0), coalesce(p_completion_tokens, 0), v_credits,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
      'cost_usd', coalesce(p_cost_usd, 0),
      'usd_brl_rate', v_cfg.usd_brl_rate,
      'cost_brl', round(coalesce(p_cost_usd, 0) * v_cfg.usd_brl_rate, 6),
      'charged_brl', round(coalesce(p_cost_usd, 0) * v_cfg.usd_brl_rate * v_margin, 6),
      'margin_multiplier', v_margin,
      'margin_overridden', (p_margin_override is not null and p_margin_override >= 0),
      'via', 'proxy',
      'hold_id', p_hold,
      'hold_kind', v_hold.kind,
      'held_credits', v_hold.credits,
      -- Rastro do split: sem isto, um atendimento não tem como responder
      -- "por que meu bônus caiu e o comprado não?" olhando só o log.
      'held_bonus', v_hold.held_bonus,
      'held_balance', v_hold.held_balance,
      'allow_bonus', coalesce(v_hold.allow_bonus, false),
      'charged_bonus', v_use_bonus,
      'charged_balance', v_use_balance
    )
  );

  update public.credit_holds
     set status = 'settled', settled_at = now()
   where id = p_hold;

  return v_credits;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Liberação: devolve nos dois potes
-- ---------------------------------------------------------------------------
-- Holds ANTIGOS (criados antes desta migration) têm held_bonus/held_balance = 0
-- pelo default das colunas, então a soma dos dois não bate com `credits`. Para
-- não sumir com o dinheiro deles, o fallback devolve `credits` inteiro em
-- `balance` — que é exatamente de onde saiu no esquema antigo.
create or replace function public.release_hold(p_hold uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hold public.credit_holds%rowtype;
  v_bonus numeric;
  v_balance numeric;
begin
  select * into v_hold from public.credit_holds where id = p_hold for update;
  if not found then return; end if;
  if v_hold.status <> 'open' then return; end if;

  if coalesce(v_hold.held_bonus, 0) + coalesce(v_hold.held_balance, 0) = 0 and v_hold.credits > 0 then
    v_bonus := 0; v_balance := v_hold.credits;      -- hold pré-migration
  else
    v_bonus := coalesce(v_hold.held_bonus, 0); v_balance := coalesce(v_hold.held_balance, 0);
  end if;

  update public.credits
     set bonus_balance = bonus_balance + v_bonus,
         balance       = balance + v_balance,
         updated_at    = now()
   where user_id = v_hold.user_id;

  update public.credit_holds
     set status = 'released', settled_at = now()
   where id = p_hold;
end;
$$;

create or replace function public.release_stale_holds(
  p_user uuid default null,
  p_older_than interval default '01:00:00'
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer := 0;
  v_hold record;
  v_bonus numeric;
  v_balance numeric;
begin
  for v_hold in
    select id, user_id, credits, held_bonus, held_balance
      from public.credit_holds
     where status = 'open'
       and created_at < now() - p_older_than
       and (p_user is null or user_id = p_user)
     for update skip locked
  loop
    -- Mesmo fallback do release_hold para holds pré-migration.
    if coalesce(v_hold.held_bonus, 0) + coalesce(v_hold.held_balance, 0) = 0 and v_hold.credits > 0 then
      v_bonus := 0; v_balance := v_hold.credits;
    else
      v_bonus := coalesce(v_hold.held_bonus, 0); v_balance := coalesce(v_hold.held_balance, 0);
    end if;

    update public.credits
       set bonus_balance = bonus_balance + v_bonus,
           balance       = balance + v_balance,
           updated_at    = now()
     where user_id = v_hold.user_id;

    update public.credit_holds
       set status = 'released', settled_at = now()
     where id = v_hold.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Leitura de saldo
-- ---------------------------------------------------------------------------
-- `get_balance_admin` passa a devolver o TOTAL (comprado + bônus), mantendo a
-- assinatura e o tipo de retorno.
--
-- ISTO NÃO É COSMÉTICO. Todo gate de 402 do proxy é `getBalance(userId) > 0`
-- (chat/completions:825, images:230, videos:102). Se a função continuasse
-- devolvendo só `balance`, um usuário recém-cadastrado — 400 de bônus, 0 de
-- comprado — levaria "créditos esgotados" ANTES de chegar no hold, e a franquia
-- de boas-vindas seria inutilizável. O gate precisa enxergar os dois potes; quem
-- decide se o bônus PODE ser usado naquela requisição é o `hold_credits`.
create or replace function public.get_balance_admin(p_user uuid)
returns numeric
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select balance + bonus_balance from public.credits where user_id = p_user),
    0
  );
$$;

-- Leitura DISCRIMINADA, para as telas que precisam mostrar os dois separados.
-- Função nova em vez de mudar o tipo de retorno da de cima: assim nenhum gate
-- existente precisa ser tocado nesta migration.
create or replace function public.get_credit_balances_admin(p_user uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select jsonb_build_object(
       'balance', balance,
       'bonus', bonus_balance,
       'total', balance + bonus_balance
     ) from public.credits where user_id = p_user),
    jsonb_build_object('balance', 0, 'bonus', 0, 'total', 0)
  );
$$;

revoke all on function public.get_credit_balances_admin(uuid) from public, anon, authenticated;
grant execute on function public.get_credit_balances_admin(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9) Débito DIRETO (sem hold) também respeita os potes
-- ---------------------------------------------------------------------------
-- `spend_openrouter_usage_admin` é o caminho que NÃO passa por reserva. Hoje ele
-- cobra a geração de imagem no Vertex (chat/completions/route.ts:439, o
-- `proxyVertexImage`, que gera primeiro e debita depois) e o branch legado do
-- status de vídeo. Como o caso principal é Vertex, deixar esta função cega ao
-- bônus faria a imagem queimar crédito COMPRADO com a franquia parada ao lado.
--
-- `new_balance` passa a ser o TOTAL, para casar com `get_balance_admin` — o
-- status de vídeo infere os créditos cobrados pelo delta de duas leituras de
-- saldo (videos/status/route.ts:496-498) e as duas pontas precisam medir a
-- mesma coisa.
create or replace function public.spend_openrouter_usage_admin(
  p_user              uuid,
  p_cost_usd          numeric,
  p_model             text default null,
  p_prompt_tokens     integer default 0,
  p_completion_tokens integer default 0,
  p_meta              jsonb default '{}'::jsonb,
  p_margin_override   numeric default null,
  p_allow_bonus       boolean default false
)
returns table(new_balance numeric, credits_spent numeric)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cfg         public.billing_config%rowtype;
  v_credits     numeric;
  v_margin      numeric;
  v_bonus       numeric;
  v_use_bonus   numeric;
  v_use_balance numeric;
begin
  if p_user is null then raise exception 'usuário ausente'; end if;
  if p_cost_usd is null or p_cost_usd < 0 then raise exception 'custo inválido'; end if;

  select * into v_cfg from public.billing_config limit 1;
  if not found then raise exception 'billing_config ausente'; end if;

  -- Margem efetiva: override válido (não nulo E >= 0) tem precedência.
  if p_margin_override is not null and p_margin_override >= 0 then
    v_margin := p_margin_override;
  else
    v_margin := v_cfg.margin_multiplier;
  end if;

  v_credits := round(p_cost_usd * v_cfg.usd_brl_rate * v_margin / v_cfg.credit_brl, 6);

  select bonus_balance into v_bonus
    from public.credits where user_id = p_user for update;

  if not found then
    -- Sem linha de crédito: cria zerada e cobra tudo do comprado (fica negativo
    -- e o trigger clampa em 0) — mesmo comportamento de antes.
    insert into public.credits (user_id, balance) values (p_user, -v_credits);
    v_use_bonus := 0;
    v_use_balance := v_credits;
  else
    if coalesce(p_allow_bonus, false) then
      v_use_bonus := least(v_credits, greatest(coalesce(v_bonus, 0), 0));
    else
      v_use_bonus := 0;
    end if;
    v_use_balance := v_credits - v_use_bonus;

    update public.credits
       set bonus_balance = bonus_balance - v_use_bonus,
           balance       = balance - v_use_balance,
           updated_at    = now()
     where user_id = p_user;
  end if;

  insert into public.usage_log (user_id, kind, model, prompt_tokens, completion_tokens, credits, meta)
  values (
    p_user, 'openrouter', p_model, p_prompt_tokens, p_completion_tokens, v_credits,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
      'cost_usd', p_cost_usd,
      'usd_brl_rate', v_cfg.usd_brl_rate,
      'cost_brl', round(p_cost_usd * v_cfg.usd_brl_rate, 6),
      'charged_brl', round(p_cost_usd * v_cfg.usd_brl_rate * v_margin, 6),
      'margin_multiplier', v_margin,
      'margin_overridden', (p_margin_override is not null and p_margin_override >= 0),
      'via', 'proxy',
      'allow_bonus', coalesce(p_allow_bonus, false),
      'charged_bonus', v_use_bonus,
      'charged_balance', v_use_balance
    )
  );

  return query
    select c.balance + c.bonus_balance, v_credits from public.credits c where c.user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) Permissões + remoção das assinaturas antigas
-- ---------------------------------------------------------------------------
revoke all on function public.hold_credits(uuid, numeric, text, text, boolean) from public, anon, authenticated;
grant execute on function public.hold_credits(uuid, numeric, text, text, boolean) to service_role;
revoke all on function public.spend_openrouter_usage_admin(uuid, numeric, text, integer, integer, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.spend_openrouter_usage_admin(uuid, numeric, text, integer, integer, jsonb, numeric, boolean) to service_role;

-- O parâmetro extra cria uma função NOVA (sobrecarga), não substitui a antiga.
-- As duas convivendo seriam pior que qualquer uma sozinha: uma chamada com os
-- argumentos antigos fica AMBÍGUA para o PostgREST e falha, e — se resolvesse —
-- resolveria para a versão cega ao bônus. Removidas.
drop function if exists public.hold_credits(uuid, numeric, text, text);
drop function if exists public.spend_openrouter_usage_admin(uuid, numeric, text, integer, integer, jsonb, numeric);
