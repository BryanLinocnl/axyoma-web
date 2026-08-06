-- =============================================================================
-- `flowConfig` em `plans.features` — rotação de modelos (specs/flow-config.md §5).
--
-- Pro e Teams. Free não recebe.
--
-- MERGE (`||`), não substituição do objeto. A `20260726_plan_features.sql`
-- escreveu o objeto inteiro, e desde então ele ganhou campos que NÃO estão em
-- migration nenhuma — o `messaging` foi aplicado direto no banco. Reescrever o
-- objeto aqui apagaria esse campo e derrubaria os canais de mensagem de todos os
-- assinantes, num efeito que só apareceria quando alguém tentasse usar o
-- Telegram e recebesse `plan_required`.
--
-- O `||` também torna a migration idempotente: rodar duas vezes escreve o mesmo
-- valor.
--
-- ── O QUE ESTE CAMPO NÃO FAZ ────────────────────────────────────────────────
--
-- Diferente do `messaging`, ele não tem contrapartida no proxy. A rotação
-- acontece inteira na máquina do usuário, e turno BYOK nem passa por aqui. Este
-- campo alimenta o `/api/v1/entitlements`, que alimenta o gate do app — em dois
-- lugares: o card das Configurações (o que aparece) e o `podeUsarFlow()` do
-- processo main (o que de fato roda).
-- =============================================================================

update public.plans
   set features = features || '{"flowConfig": false}'::jsonb
 where id = 'free';

update public.plans
   set features = features || '{"flowConfig": true}'::jsonb
 where id in ('solo', 'teams');
