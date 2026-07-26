-- =============================================================================
-- Recursos por plano, como DADO — não como condicional espalhada pelo código.
--
-- Antes o app perguntava "o usuário é solo/teams?" em três lugares diferentes
-- (Modo Design, catálogo de skills, tier das skills). Cada recurso novo exigia
-- tocar em código e publicar release. Com `features`, mudar o que um plano
-- entrega é um UPDATE.
--
-- O objeto descreve o que EXISTE hoje, sem inventar limite que o produto não
-- tem: o único eixo real do catálogo de skills é o TIER (`common` = 166 skills,
-- `teams` = mais 41). Não há um "maxSkills" implementado, então ele não entra
-- aqui — o objeto é a fonte de verdade dos gates, e um número fictício viraria
-- um gate mentiroso.
--
-- A policy `plans_read` (migration 0028) já cobre a coluna nova: não há mudança
-- de RLS. Ainda assim o cliente NÃO lê esta tabela direto — quem resolve a
-- assinatura ativa e devolve só as features do plano do usuário é
-- `/api/v1/entitlements`.
--
-- Idempotente. APLICADA em 2026-07-26.
-- =============================================================================

alter table public.plans
  add column if not exists features jsonb not null default '{}'::jsonb;

update public.plans
   set features = '{"design":false,"skillsCatalog":false,"skillTiers":[],"maxMembers":1}'::jsonb
 where id = 'free';

update public.plans
   set features = '{"design":true,"skillsCatalog":true,"skillTiers":["common"],"maxMembers":1}'::jsonb
 where id = 'solo';

update public.plans
   set features = '{"design":true,"skillsCatalog":true,"skillTiers":["common","teams"],"maxMembers":4}'::jsonb
 where id = 'teams';
