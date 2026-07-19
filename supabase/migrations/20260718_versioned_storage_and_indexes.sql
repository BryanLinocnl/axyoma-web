-- =============================================================================
-- Versionamento de objetos aplicados AD-HOC em produção (Fase 3, item 7).
-- Estes objetos já existem no banco de produção (o lead aplicou ao vivo); este
-- arquivo os torna reproduzíveis em ambientes novos. Todos idempotentes.
--
--   * bucket privado `generations` (armazena as imagens do Playground P6);
--   * policies gen_select/insert/delete_own em storage.objects, escopadas ao
--     path `${uid}/...` (o proxy sobe com a service-role, mas as policies
--     garantem que só o dono lê/apaga se acessar direto);
--   * índice ÚNICO em model_news(url) (dedupe do agregador de notícias).
--
-- NÃO aplicar automaticamente — revisar e aplicar manualmente.
-- =============================================================================

-- --- bucket generations (privado) -------------------------------------------
insert into storage.buckets (id, name, public)
values ('generations', 'generations', false)
on conflict (id) do nothing;

drop policy if exists "gen_select_own" on storage.objects;
create policy "gen_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gen_insert_own" on storage.objects;
create policy "gen_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gen_delete_own" on storage.objects;
create policy "gen_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

-- --- model_news: dedupe por url ---------------------------------------------
-- Índice único parcial (ignora linhas com url nula). O agregador dedupe em app,
-- mas o índice garante a invariante mesmo sob corrida/reprocessamento.
create unique index if not exists model_news_url_key
  on public.model_news (url)
  where url is not null;
