-- `billing_config` tinha RLS ligada e a policy `billing_config_read` para
-- `authenticated` — mas NUNCA teve o GRANT de SELECT na tabela.
--
-- No Postgres os dois são necessários e atuam em camadas diferentes: o GRANT
-- decide se você pode tocar na tabela, a POLICY decide quais linhas você vê. Sem
-- o GRANT, a policy nem chega a ser avaliada; o acesso morre antes, no privilégio.
--
-- CONSEQUÊNCIA, que passou despercebida por meses: `credits-store.ts` lê esta
-- tabela junto com `credits` num `Promise.all`, mas só checa `credRes.error` —
-- o erro da config é ignorado. Com a leitura falhando, `cfg` vinha null e o app
-- caía calado no `DEFAULT_CONFIG`. Ou seja:
--
--   • `byok_route` NUNCA teve efeito. A chave de rota do BYOK era código morto,
--     e só apareceu quando virá-la não produziu mudança nenhuma de comportamento.
--   • a taxa USD/BRL exibida ao usuário era a hardcoded 5.12, não a do banco
--     (5.086098 quando isto foi escrito). O cron diário que atualiza a taxa
--     rodava, gravava, e não chegava a ninguém.
--   • idem para `margin_multiplier` e `credit_brl`.
--
-- Um erro silencioso no cliente escondeu um erro de permissão no servidor.
grant select on public.billing_config to authenticated;

-- Defesa em profundidade: os grants de escrita existiam por herança e eram
-- redundantes (a RLS só tem policy de SELECT, então o UPDATE já era negado na
-- prática). Numa tabela que define câmbio e margem, grant redundante é o tipo de
-- coisa que vira escrita real no dia em que alguém adicionar uma policy
-- permissiva ou desligar RLS numa migration.
revoke insert, update, delete on public.billing_config from anon, authenticated;
