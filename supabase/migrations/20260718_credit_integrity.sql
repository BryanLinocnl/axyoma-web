-- =============================================================================
-- Integridade de crédito (Fase 3): marcador de reconciliação.
--
-- Quando o débito de uma geração LANÇA exceção (não sabemos se aplicou), o proxy
-- NÃO retenta (evitaria dupla cobrança) e insere um marcador aqui para
-- conciliação posterior. O caminho normal (usage.cost presente, ou o mínimo)
-- debita direto — esta tabela cobre só o caso de falha do débito.
--
-- Idempotente. NÃO aplicar automaticamente — revisar e aplicar manualmente.
-- =============================================================================

create table if not exists public.pending_charges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('chat', 'image')),
  model      text,
  cost_usd   numeric,
  reason     text not null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pending_charges enable row level security;

-- O dono pode LER seus próprios marcadores (inócuo). Escrita só service-role.
drop policy if exists "pending_charges_select_own" on public.pending_charges;
create policy "pending_charges_select_own" on public.pending_charges
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.pending_charges from anon, authenticated;
