-- Primeiro modelo de GERAÇÃO DE FALA (TTS) do catálogo AXYOMA.
--
-- Contexto: até aqui o app ouvia e não falava. `public.models` tinha duas linhas
-- com saída de áudio, e nenhuma servia:
--
--   google/lyria-002            gera MÚSICA instrumental, não voz.
--   google/gemini-live-2.5-flash  Live API — WebSocket bidirecional para conversa
--                               em tempo real, não uma chamada que recebe texto e
--                               devolve um arquivo. As duas seguem desligadas.
--
-- O `gemini-2.5-flash-preview-tts` é request/response pelo MESMO endpoint nativo
-- `:generateContent` que a geração de imagem já usa — muda só o
-- `responseModalities` (['AUDIO']) e o `speechConfig`. Por isso ele entra como
-- api_flavor PRÓPRIA (`gemini_tts`) e não como `gemini_image`: o corpo enviado e
-- o formato da resposta são outros, e é o api_flavor que escolhe o adapter na
-- rota (mesmo desenho de `veo` vs `interactions`).
--
-- FORMATO DA SAÍDA: a Vertex devolve PCM CRU em `inlineData`
-- (`audio/L16;codec=pcm;rate=24000`), não um arquivo tocável. A rota
-- /api/v1/speech embrulha em WAV antes de responder — ver lib/vertex.ts.
--
-- PREÇO — CONFIRMAR ANTES DE ABRIR AO PÚBLICO. Os valores abaixo são os
-- publicados para o Gemini 2.5 Flash TTS (entrada de TEXTO e saída de ÁUDIO são
-- cobradas em tokens, com tabelas diferentes). A cobrança usa o `usageMetadata`
-- real da resposta × estes números, então um erro aqui é erro de margem, não de
-- contagem. A rota RECUSA gerar se o preço de saída não for > 0, para nunca
-- entregar áudio de graça (mesmo guard do ramo Vertex de imagem).

-- `api_flavor` é lista fechada por CHECK. Sem ampliar aqui, o insert abaixo
-- estoura com `models_api_flavor_check` — foi o que a validação em
-- begin/rollback pegou antes de aplicar.
alter table public.models drop constraint if exists models_api_flavor_check;
alter table public.models add constraint models_api_flavor_check check (
  api_flavor = any (array[
    'openai', 'anthropic', 'gemini_image', 'veo', 'imagen',
    'embedding', 'gemini_live', 'lyria', 'interactions', 'gemini_tts'
  ])
);

insert into public.models (
  id,
  display_name,
  description,
  provider,
  api_flavor,
  vertex_publisher,
  upstream_model_id,
  region,
  context_length,
  max_output_tokens,
  input_modalities,
  output_modalities,
  supports_tools,
  supports_reasoning,
  supported_parameters,
  input_price_usd_per_mtok,
  output_price_usd_per_mtok,
  enabled,
  sort_order,
  metadata
) values (
  'google/gemini-2.5-flash-preview-tts',
  'Gemini 2.5 Flash TTS (Preview)',
  'Gera fala a partir de texto. Voz escolhida por nome; PCM 24 kHz mono embrulhado em WAV pelo proxy.',
  'vertex',
  'gemini_tts',
  'google',
  'gemini-2.5-flash-preview-tts',
  -- `us-central1` e não `global`: os modelos TTS em preview são publicados por
  -- região, e esta é a que serve o flash-tts. A região é validada contra
  -- VERTEX_ALLOWED_LOCATIONS no model-registry (anti-SSRF) — as duas usadas hoje
  -- pelo catálogo (`us-central1` e `global`) já estão lá.
  'us-central1',
  8192,
  8192,
  '{text}',
  '{audio}',
  false,
  false,
  '{}',
  0.50,
  10.00,
  true,
  -- Depois dos modelos de chat e mídia já cadastrados: é infraestrutura, não
  -- modelo que alguém escolhe para conversar.
  900,
  -- `voices` aqui, e não no código, para uma voz nova entrar sem deploy. A rota
  -- valida contra esta lista e cai na `default_voice` quando o pedido não traz
  -- voz. Nomes conforme os prebuilt voices do Vertex.
  jsonb_build_object(
    'default_voice', 'Kore',
    'voices', jsonb_build_array(
      'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
      'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
      'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
      'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
      'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
    ),
    'sample_rate_hz', 24000
  )
)
-- Idempotente: reaplicar a migration atualiza a linha em vez de estourar por
-- chave duplicada. `enabled` e preço entram no update de propósito — é por aqui
-- que uma correção de preço chega ao ambiente.
on conflict (id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  provider = excluded.provider,
  api_flavor = excluded.api_flavor,
  vertex_publisher = excluded.vertex_publisher,
  upstream_model_id = excluded.upstream_model_id,
  region = excluded.region,
  input_modalities = excluded.input_modalities,
  output_modalities = excluded.output_modalities,
  input_price_usd_per_mtok = excluded.input_price_usd_per_mtok,
  output_price_usd_per_mtok = excluded.output_price_usd_per_mtok,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

-- `pending_charges` é o marcador de reconciliação de quando a geração saiu mas o
-- débito falhou. O CHECK só conhecia chat/image/video; sem `speech` aqui, a rota
-- de fala teria que gravar a falha como 'chat' — e o relatório de conciliação
-- passaria a mentir sobre de onde veio a cobrança perdida.
alter table public.pending_charges drop constraint if exists pending_charges_kind_check;
alter table public.pending_charges add constraint pending_charges_kind_check check (
  kind = any (array['chat', 'image', 'video', 'speech'])
);
