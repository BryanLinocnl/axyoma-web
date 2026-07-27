-- Catálogo de modelos dos provedores em que a chave é DO USUÁRIO (BYOK).
--
-- CAMADA DE CORREÇÃO, não fonte primária. O app monta o catálogo da OpenAI
-- cruzando a lista da conta do usuário (API da OpenAI, com a chave dele) com os
-- metadados do catálogo público da OpenRouter, que lista os mesmos modelos como
-- `openai/<id>` e devolve preço, janela de contexto e capacidades. Esta tabela
-- entra por cima disso, e só quando alguém precisa corrigir algo:
--
--   • preço da OpenRouter divergente do preço direto da OpenAI (quem paga aqui
--     é a chave do usuário, então o número que vale é o da OpenAI);
--   • modelo que a OpenRouter não lista.
--
-- Vazia é o estado normal e correto.
--
-- POR QUE NÃO DÁ PARA USAR SÓ A API DA OPENAI: o `/v1/models` dela devolve
-- apenas `id`, `object`, `created` e `owned_by`. Sem preço, sem janela de
-- contexto, sem capacidades — não dá para estimar custo nem filtrar por suporte
-- a tools/visão. O catálogo da OpenRouter devolve tudo isso; é por isso que lá
-- o catálogo é automático e aqui precisa do cruzamento.
--
-- POR QUE UMA TABELA SEPARADA de `public.models`. As duas descrevem modelos, mas
-- respondem perguntas diferentes:
--
--   • `models`      → o que NÓS servimos. Carrega roteamento (`upstream_model_id`,
--                     `region`, `vertex_publisher`) e o preço que entra na NOSSA
--                     margem. Mexer nela mexe em cobrança.
--   • `byok_models` → só descrição de catálogo. Não roteia nada, e o preço é o
--                     público do fornecedor, usado apenas para estimativa na tela.
--
-- Juntar as duas obrigaria a filtrar por `provider` em TODO lugar que hoje lê a
-- tabela inteira. Esquecer um filtro colocaria um GPT na lista de créditos
-- AXYOMA — onde o turno morreria, porque não existe chave da OpenAI no servidor.
-- A separação torna esse erro impossível por construção, em vez de depender de
-- disciplina.
create table if not exists public.byok_models (
  id                              text primary key,
  -- 'anthropic' já é aceito para não exigir migration quando a fonte for
  -- liberada; hoje ela segue desligada no app por falta de adaptador de API.
  provider                        text    not null check (provider in ('openai','anthropic')),
  display_name                    text    not null,
  context_length                  integer not null default 0 check (context_length >= 0),
  max_output_tokens               integer check (max_output_tokens is null or max_output_tokens >= 0),
  input_modalities                text[]  not null default '{text}',
  output_modalities               text[]  not null default '{text}',
  supported_parameters            text[]  not null default '{}',
  input_price_usd_per_mtok        numeric not null default 0 check (input_price_usd_per_mtok  >= 0),
  output_price_usd_per_mtok       numeric not null default 0 check (output_price_usd_per_mtok >= 0),
  cached_input_price_usd_per_mtok numeric check (cached_input_price_usd_per_mtok is null or cached_input_price_usd_per_mtok >= 0),
  -- Default DESLIGADO: linha recém-inserida não aparece para ninguém até alguém
  -- conferir preço e capacidades. Preço errado vira estimativa errada na tela.
  enabled                         boolean not null default false,
  sort_order                      integer not null default 0,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists byok_models_provider_idx on public.byok_models (provider, sort_order);

alter table public.byok_models enable row level security;

drop policy if exists "byok_models read" on public.byok_models;
create policy "byok_models read" on public.byok_models
  for select to authenticated using (enabled);

-- Tabela nova em `public` HERDA grants de `anon`/`authenticated` pelos default
-- privileges do Supabase. Revogar é explícito de propósito: confiar só na RLS
-- deixa um grant solto esperando o dia em que alguém adicionar uma policy mais
-- larga. Foi exatamente o que aconteceu com `billing_config`, ao contrário —
-- policy sem grant, e a leitura falhava em silêncio por meses.
revoke all on public.byok_models from anon;
revoke insert, update, delete on public.byok_models from authenticated;
grant select on public.byok_models to authenticated;

comment on table public.byok_models is
  'Correção do catálogo de provedores BYOK (chave do usuário). NÃO é razão de '
  'cobrança e não roteia nada: preço aqui é o público do fornecedor, só para '
  'estimativa na tela. O que NÓS servimos e cobramos vive em public.models.';
