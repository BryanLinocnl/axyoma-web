-- =============================================================================
-- Saída de emergência do BYOK: por onde o tráfego da chave DO USUÁRIO passa.
--
--   'proxy'  (default) — pelo nosso gateway. Preserva telemetria, políticas e o
--                        tratamento de erro já testado em produção.
--   'direct' — o desktop fala direto com o fornecedor, com a chave do usuário.
--
-- POR QUE ISTO EXISTE: o custo de BYOK pelo proxy (duração de função, banda) é
-- nosso e não gera receita — ele cresce exatamente na proporção do sucesso da
-- feature. Se um dia incomodar, esta chave vira 'direct' e o tráfego sai do
-- nosso caminho SEM release do app e SEM migrar segredo: a chave já mora na
-- máquina do usuário, por decisão de custódia tomada lá no início.
--
-- Mora em `billing_config` porque essa tabela já é, de fato, a config PÚBLICA da
-- plataforma que o cliente lê (guarda também os product ids de pagamento) — e o
-- desktop já a consulta a cada refresh de crédito, então não custa requisição
-- nova. O CHECK impede um valor digitado errado virar comportamento indefinido;
-- valor desconhecido no cliente também cai em 'proxy'.
--
-- Idempotente. APLICADA em 2026-07-26.
-- =============================================================================

alter table public.billing_config
  add column if not exists byok_route text not null default 'proxy'
  check (byok_route in ('proxy', 'direct'));
