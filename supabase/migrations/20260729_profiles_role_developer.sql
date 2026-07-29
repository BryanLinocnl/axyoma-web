-- Papel do usuário: quem ele É no sistema, separado do que ele COMPROU.
--
-- `plans` é tabela comercial — tem preço, período e limite de membros. O papel
-- `developer` não pertence ali: não é vendido, não expira, e uma linha de
-- R$ 0,00 em `plans` apareceria para sempre nos relatórios de receita. Plano e
-- papel ficam ortogonais: um developer continua tendo (ou não) uma assinatura,
-- e é o papel que libera as páginas internas.
--
-- A coluna `role` já existia desde a criação de `profiles`, mas estava NULL nos
-- quatro usuários da base: nada nunca escreveu nela.
--
-- CONCESSÃO vem da env `ADMIN_EMAILS`, não daqui. Esta coluna é o ESPELHO,
-- sincronizado no login com a service role, para que o banco e o proxy possam
-- aplicar regras (bypass de cobrança, RLS de tabelas internas) sem consultar
-- variável de ambiente — coisa que SQL não faz.

alter table public.profiles alter column role set default 'user';
update public.profiles set role = 'user' where role is null;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'developer'));
alter table public.profiles alter column role set not null;

comment on column public.profiles.role is
  'Papel no sistema: user | developer. Espelho da env ADMIN_EMAILS, escrito só pela service role (ver trigger profiles_protect_role). NÃO é plano — plano vive em subscriptions/plans.';

-- BURACO QUE ESTA MIGRATION FECHA.
--
-- A policy `profiles_update_own` permite ao usuário atualizar QUALQUER coluna do
-- próprio perfil, `role` inclusive. Enquanto a coluna não era usada por nada,
-- isso era inofensivo. No instante em que ela vira controle de acesso, qualquer
-- usuário se promoveria a `developer` com um UPDATE de uma linha — e ganharia
-- as páginas internas e o bypass de cobrança.
--
-- RLS não restringe por COLUNA num UPDATE (o with_check avalia a linha inteira),
-- então a trava é um trigger. Ele lança exceção em vez de reverter em silêncio:
-- uma promoção negada caladamente viraria bug de suporte difícil de enxergar.
--
-- Verificado em 29/07/2026, com as três consultas que importam:
--   dono autenticado se promovendo  → BLOQUEADO, 0 linhas
--   dono editando `company`         → PERMITIDO, 1 linha
--   service role concedendo         → PERMITIDO, 1 linha
-- O `row_count` faz parte do teste de propósito: com um `sub` que não casa com
-- a linha, a RLS filtra tudo, o UPDATE afeta zero linhas e o trigger nunca
-- dispara — o que passa por "permitido" sem nada ter sido testado.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'role só pode ser alterado pelo servidor';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ── Correção aplicada em seguida, no mesmo dia ──────────────────────────────
--
-- O teste acima usava `auth.role() <> 'service_role'`. Numa conexão
-- administrativa direta `auth.role()` é NULO, então a trava bloqueava até o dono
-- do banco — descoberto ao tentar promover a primeira conta. O que identifica um
-- pedido de usuário logado é o ROLE do executor: PostgREST entra como
-- `authenticated` (JWT de usuário) ou `anon`; service role e psql, não.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user in ('authenticated', 'anon') then
    raise exception 'role só pode ser alterado pelo servidor';
  end if;
  return new;
end $$;
