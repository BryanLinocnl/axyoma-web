-- =============================================================================
-- Defesa-em-profundidade no canal web→desktop (Fase 3, item 9).
--
-- `integrations_config` guarda PREFERÊNCIAS não-executáveis. O desktop é quem
-- DEVE validar contra allow-list antes de executar qualquer comando MCP (ver
-- docs/security-web-desktop.md). Como reforço no lado do banco (vale mesmo que
-- um atacante com a sessão da vítima escreva direto no PostgREST), este trigger
-- rejeita metacaracteres de shell / paths perigosos no campo `command` dos
-- servidores MCP e valida a `url`. Não substitui a validação do desktop.
--
-- Idempotente. NÃO aplicar automaticamente — revisar e aplicar manualmente.
-- =============================================================================

create or replace function public.integrations_config_guard()
returns trigger
language plpgsql
as $$
declare
  srv jsonb;
  cmd text;
  u text;
begin
  if new.provider = 'mcp' and jsonb_typeof(new.config -> 'servers') = 'array' then
    for srv in select * from jsonb_array_elements(new.config -> 'servers') loop
      cmd := coalesce(srv ->> 'command', '');
      u := coalesce(srv ->> 'url', '');

      -- Bloqueia metacaracteres de shell e substituição de comando.
      if cmd ~ '[;&|`$<>\n\r]' or cmd like '%$(%' then
        raise exception 'comando MCP com metacaractere de shell não é permitido';
      end if;
      if length(cmd) > 500 or length(u) > 1000 then
        raise exception 'campo MCP grande demais';
      end if;
      if u <> '' and u !~* '^https?://' then
        raise exception 'url MCP deve ser http(s)';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists integrations_config_guard_trg on public.integrations_config;
create trigger integrations_config_guard_trg
  before insert or update on public.integrations_config
  for each row execute function public.integrations_config_guard();
