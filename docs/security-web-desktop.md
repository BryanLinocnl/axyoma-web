# Modelo de confiança do canal Web ↔ Desktop (AXYOMA AI)

Fase 3 — Segurança. Este documento define e fixa o modelo de confiança entre o
**Axyoma Web** (dashboard Next.js) e o **Axyoma Code / desktop** (Electron).

## Princípio central

> **Não existe canal direto web → máquina.** O web nunca envia comandos, scripts,
> caminhos ou payloads executáveis ao desktop. O único acoplamento são **duas
> tabelas Supabase de PREFERÊNCIA**, sob RLS do próprio usuário, que o desktop
> **lê, valida e aplica localmente**.

As tabelas do canal:

| Tabela                | O que o web ESCREVE                                              | Sensível? |
|-----------------------|-----------------------------------------------------------------|-----------|
| `model_selection`     | quais `model_id` o usuário deixou ativos (`enabled`)            | não       |
| `integrations_config` | config não-secreta de GitHub/Vercel/MCP (nomes, flags, comando/URL de MCP) | não |

Ambas: RLS `auth.uid() = user_id` (o dono só lê/escreve as próprias linhas).
Sincronização com o desktop via **Supabase Realtime** (`postgres_changes`), com o
JWT do dono — o RLS continua valendo por assinante.

## Segredos NÃO trafegam por essas tabelas

Tokens (PAT do GitHub, token da Vercel, chaves/headers de MCP) são cifrados no
**Supabase Vault** e **nunca** voltam ao browser:

- **web grava**: browser → `POST /api/integrations/secret` (HTTPS, nosso servidor)
  → RPC `integration_secret_set` (service-role) → `vault.create_secret`. O valor
  nunca entra em `integrations_config` nem é ecoado.
- **desktop lê**: edge function `integration-secret-read` com o JWT do dono →
  RPC `integration_secret_get_all` (service-role) → `vault.decrypted_secrets`.
  Entregue só ao dono, sobre TLS.

Mapeamento em `integration_secrets(user_id, provider, field, vault_secret_id)`,
RLS ON, **sem policies** (trancado para service-role).

## Regras OBRIGATÓRIAS do lado desktop

O desktop trata todo valor dessas tabelas como **não confiável** (pode ter sido
escrito por um atacante com a sessão web da vítima):

1. **`model_id`** (de `model_selection`): validar contra o **catálogo de modelos**
   conhecido antes de usar. Ignorar ids desconhecidos.
2. **MCP `command`** (de `integrations_config`): **NUNCA** executar direto.
   Validar contra uma **allow-list** de binários (`npx`, `uvx`, `node`, `python`,
   `deno`, ...) e argumentos; rejeitar metacaracteres de shell (`; & | \` $ < >`),
   substituição de comando (`$(...)`), e caminhos absolutos a diretórios sensíveis.
   Executar **sem shell** (argv array, `shell: false`).
3. **MCP `url`** (http/sse): aceitar só `http(s)://`; sem `file:`/esquemas exóticos.
4. **Nomes de repo/projeto/username**: tratar como texto; nunca interpolar em
   comando shell sem escapar.

## Por que o pior caso não é RCE

Como não há canal de execução web→máquina e o desktop valida tudo, um atacante
que comprometa a sessão web da vítima consegue **no máximo** alterar preferências
(virar um modelo, mexer numa flag) na conta dela — **sem execução remota de
código** na máquina. Segredos não são expostos (só o desktop autenticado os lê).

## Reforço no lado do banco (defesa em profundidade)

`integrations_config` tem um trigger (`integrations_config_guard`) que rejeita, já
na escrita, comandos MCP com metacaracteres de shell / campos gigantes / URLs não
http(s). Isso NÃO substitui a validação do desktop — é uma barreira extra caso um
cliente malicioso escreva direto no PostgREST.
