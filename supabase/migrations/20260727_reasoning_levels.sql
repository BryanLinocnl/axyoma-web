-- Níveis de esforço de raciocínio ACEITOS POR MODELO.
--
-- POR QUE EXISTE. A UI tinha uma lista fixa e global (`EFFORT_ORDER` em
-- `ChatInput.tsx`) com low/medium/high, empurrada para todo modelo. Duas coisas
-- quebravam por causa disso:
--
--   • gpt-5.2-pro RECUSA 'low' — o turno morria com 400 e o app só descobria
--     depois de errar, remapeando no retry. Erro que o usuário nunca vê é
--     melhor que erro corrigido bem.
--   • modelos que suportam MAIS que 'high' (o 'xhigh' do próprio 5.2-pro)
--     nunca alcançavam: a constante era o teto de todo mundo.
--
-- NULO = "sem controle de esforço declarado". A UI então usa o padrão
-- low/medium/high, que é o comportamento histórico. Isso é deliberado: os
-- modelos da OpenRouter vêm do catálogo VIVO deles, não desta tabela, e
-- cadastrar milhares de linhas para repetir o padrão seria manutenção sem
-- retorno. Só se declara aqui quem foge da regra.
alter table public.models      add column if not exists reasoning_levels text[];
alter table public.byok_models add column if not exists reasoning_levels text[];

comment on column public.models.reasoning_levels is
  'Níveis de esforço aceitos pelo modelo, em ordem crescente. NULO = usa o '
  'padrão low/medium/high da UI. Só preencher quem foge da regra.';

-- Vertex/Gemini: o parâmetro é `thinking_config.thinking_level`, que aceita
-- apenas 'low' e 'high' — `thinking_budget` é ignorado pelo 3.x. Oferecer
-- "Médio" ali é oferecer um nível que não existe do outro lado.
update public.models
   set reasoning_levels = array['low','high']
 where provider = 'vertex' and supports_reasoning;

-- Override do gpt-5.2-pro. Vive em `byok_models` porque o catálogo da OpenAI
-- é montado no app (lista da conta do usuário × metadados da OpenRouter), e
-- esta tabela é justamente a camada de correção desse cruzamento.
--
-- Mensagem literal da API que motivou a linha:
--   "Unsupported value: 'low' is not supported with the 'gpt-5.2-pro' model.
--    Supported values are: 'medium', 'high', and 'xhigh'."
insert into public.byok_models (id, provider, display_name, reasoning_levels, enabled, sort_order)
values ('gpt-5.2-pro', 'openai', 'GPT-5.2 Pro', array['medium','high','xhigh'], true, 1)
on conflict (id) do update
  set reasoning_levels = excluded.reasoning_levels,
      enabled          = true;
