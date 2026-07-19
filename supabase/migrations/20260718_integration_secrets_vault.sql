-- =============================================================================
-- Segredos de integração cifrados no Supabase Vault (Fase 3 / P4).
--
-- Tokens do GitHub/Vercel/MCP NÃO ficam em claro na nuvem nem em
-- `integrations_config`. Guardamos o VALOR cifrado no Vault e mapeamos
-- (user_id, provider, field) → vault_secret_id em `integration_secrets`.
--
-- Acesso:
--   * write: RPC `integration_secret_set` (SECURITY DEFINER), chamada pela
--     service-role a partir do endpoint HTTPS `/api/integrations/secret` (web) e
--     da edge function `integration-secret-write` (opcional). O valor entra
--     cifrado; nunca volta ao browser.
--   * read: RPC `integration_secret_get_all` (SECURITY DEFINER), chamada pela
--     service-role a partir da edge function `integration-secret-read` que o
--     DESKTOP invoca com o JWT do dono. Só devolve os segredos do próprio user.
--
-- Idempotente. NÃO aplicar automaticamente — revisar e aplicar manualmente.
-- =============================================================================

-- O Vault já vem habilitado nos projetos Supabase; garante a extensão.
create extension if not exists supabase_vault with schema vault;

create table if not exists public.integration_secrets (
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('github', 'vercel', 'mcp')),
  field           text not null,
  vault_secret_id uuid not null,
  updated_at      timestamptz not null default now(),
  primary key (user_id, provider, field)
);

alter table public.integration_secrets enable row level security;
-- Sem policies: trancado para service-role. O browser jamais lê/escreve esta
-- tabela (nem sequer o mapeamento). Toda a interação passa pelas RPCs abaixo.
revoke all on public.integration_secrets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- write: cria (ou atualiza) o secret no Vault e o mapeia.
-- ---------------------------------------------------------------------------
-- Retorna jsonb (não void) para o helper `rpc()` do web (que faz res.json())
-- não quebrar num corpo vazio. Drop antes por segurança (mudança de tipo de
-- retorno exige recriar).
drop function if exists public.integration_secret_set(uuid, text, text, text);
create or replace function public.integration_secret_set(
  p_user uuid,
  p_provider text,
  p_field text,
  p_value text
) returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_existing uuid;
  v_name text;
begin
  if p_provider not in ('github', 'vercel', 'mcp') then
    raise exception 'provider inválido';
  end if;

  select vault_secret_id into v_existing
  from public.integration_secrets
  where user_id = p_user and provider = p_provider and field = p_field;

  if v_existing is null then
    v_name := 'integration:' || p_user::text || ':' || p_provider || ':' || p_field;
    select vault.create_secret(p_value, v_name, 'axyoma integration secret') into v_existing;
    insert into public.integration_secrets (user_id, provider, field, vault_secret_id, updated_at)
    values (p_user, p_provider, p_field, v_existing, now());
  else
    perform vault.update_secret(v_existing, p_value);
    update public.integration_secrets
      set updated_at = now()
      where user_id = p_user and provider = p_provider and field = p_field;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.integration_secret_set(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.integration_secret_set(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- read: descifra e devolve TODOS os segredos do usuário (só do próprio user).
-- ---------------------------------------------------------------------------
create or replace function public.integration_secret_get_all(p_user uuid)
returns table(provider text, field text, value text)
language sql
security definer
set search_path = public, vault
as $$
  select s.provider, s.field, ds.decrypted_secret
  from public.integration_secrets s
  join vault.decrypted_secrets ds on ds.id = s.vault_secret_id
  where s.user_id = p_user;
$$;

revoke all on function public.integration_secret_get_all(uuid) from public, anon, authenticated;
grant execute on function public.integration_secret_get_all(uuid) to service_role;
