-- =============================================================================
-- `supported_parameters` reconciliado com `supports_tools`/`supports_reasoning`.
--
-- ── O DEFEITO ────────────────────────────────────────────────────────────────
--
-- A tabela descreve a mesma capacidade de DUAS formas, e elas divergiram:
--
--   google/gemini-3.6-flash    supports_tools=true  supported_parameters={}
--   google/gemini-3.5-flash-lite               idem
--   google/gemini-3.1-pro-preview-customtools  idem
--   google/gemini-live-2.5-flash               idem (desabilitado)
--
-- A rota `/api/v1/models` servia SÓ o array, então esses modelos chegavam ao app
-- anunciando que não aceitam ferramenta nenhuma. O estrago não fica na etiqueta:
-- o app FILTRA por `supported_parameters`, então o Gemini 3.6 Flash sumia do
-- seletor de modelo secundário do Flow Config e ficava sem o chip "Tools" no
-- grid — ligado, capaz, e invisível. Reportado pelo dono em 06/08.
--
-- ── UNIÃO, NÃO SUBSTITUIÇÃO ─────────────────────────────────────────────────
--
-- Os dois lados só AFIRMAM capacidade; nenhum deles nega. Array vazio é
-- silêncio, não "não suporta nada". Por isso o `array_agg` de uma união em vez
-- de sobrescrever: quem já declara `{tools,reasoning}` fica igual, e quem estava
-- em silêncio ganha o que o booleano afirma.
--
-- Idempotente: rodar de novo produz exatamente o mesmo conjunto.
--
-- A rota também passou a fazer esta união em tempo de leitura (`parametrosDaLinha`),
-- para que uma linha meio cadastrada no futuro não repita o problema. Esta
-- migration é o conserto do dado que já existe — as duas coisas são precisas: a
-- do código sozinha exigiria deploy para cada linha nova, e a do dado sozinha
-- deixaria o próximo cadastro cair no mesmo buraco.
-- =============================================================================

update public.models m
   set supported_parameters = sub.params,
       updated_at = now()
  from (
    select
      id,
      array(
        select distinct p
          from unnest(
            coalesce(supported_parameters, '{}')
            || case when supports_tools     then array['tools']     else '{}' end
            || case when supports_reasoning then array['reasoning'] else '{}' end
          ) as p
         order by p
      ) as params
      from public.models
  ) sub
 where m.id = sub.id
   and m.supported_parameters is distinct from sub.params;
