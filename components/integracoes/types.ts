// Tipos e helpers da config de integrações (P4) — REESCRITO para espelhar o
// desktop (Configurações → GitHub / Integrações internet / MCP).
//
// IMPORTANTE (segurança): NADA aqui guarda segredos/tokens. `integrations_config`
// carrega apenas config NÃO-sensível. Os segredos (PAT do GitHub, token da
// Vercel, Access Key do Unsplash, tokens de MCP) vão para o Supabase Vault via
// `/api/integrations/secret` — ver `post-secret.ts` e `secret-field.tsx`.
//
// Mapeamento provider (a tabela restringe provider a github/vercel/mcp):
//   • github → área GitHub: { connected }               (segredo: github/pat)
//   • vercel → área "Integrações (internet)": { webSearchEnabled }
//                                    (segredos: vercel/token, vercel/unsplash_access_key)
//   • mcp    → área MCP: { enabled, servers[] }          (segredos: mcp/<serverId>.<campo>)
//
// O shape do servidor MCP ESPELHA EXATAMENTE o `McpServerConfig` do desktop
// (Aplication/src/main/ipc/mcp.ts): { id, name, command, args[], env, enabled }.
// Assim o desktop consome `integrations_config` (mcp) direto, sem tradução. Todo
// servidor salvo na nuvem tem os segredos REDIGIDOS (mesma regra do
// `sanitizeForCloud` do desktop) — o valor real só existe no Vault / na máquina.

export type Provider = 'github' | 'vercel' | 'mcp'

// github → { connected }: reflete se há um PAT guardado (área GitHub).
export type GithubConfig = {
  connected: boolean
}

// vercel → { webSearchEnabled }: estado NÃO-secreto da área "Integrações
// (internet)". As chaves (Vercel token, Unsplash) são segredos e vão pro Vault.
export type InternetConfig = {
  webSearchEnabled: boolean
}

export type McpServer = {
  id: string
  name: string
  /** Executável só (ex.: `npx`) — sem metacaractere de shell (trigger do banco). */
  command: string
  /** Argumentos separados (ex.: `["-y", "@scope/mcp"]`). Nunca a linha inteira. */
  args: string[]
  /** Variáveis de ambiente NÃO-secretas (valores redigidos p/ nuvem). */
  env: Record<string, string>
  enabled: boolean
}

export type McpConfig = {
  enabled: boolean
  servers: McpServer[]
}

export type Configs = {
  github: GithubConfig
  internet: InternetConfig
  mcp: McpConfig
}

export const DEFAULT_GITHUB: GithubConfig = { connected: false }
export const DEFAULT_INTERNET: InternetConfig = { webSearchEnabled: true } // undefined = ligado
export const DEFAULT_MCP: McpConfig = { enabled: true, servers: [] }

// --- redação de segredos ANTES de gravar na nuvem --------------------------
// Porte fiel de `redactArg` / `sanitizeForCloud` do desktop (src/main/ipc/mcp.ts).
// env → só as chaves (valores em branco); args → flags de segredo esvaziadas +
// tokens/URLs com credencial mascarados. Combinado com o env em branco, nenhum
// segredo óbvio sai do navegador para `integrations_config`.

function flagPrefix(arg: string): string | null {
  const i = arg.indexOf('=')
  return i > 0 ? arg.slice(0, i + 1) : null
}

function isSecretFlag(arg: string): boolean {
  return /(?:token|key|secret|password|pat|api[-_]?key)=/i.test(arg)
}

function redactArg(a: string): string {
  const p = flagPrefix(a)
  if (p && isSecretFlag(a) && a.length > p.length) return p
  if (/^(sbp_|ghp_|gho_|github_pat_|sk-|sk_|xox[bap]-|figd_|ntn_|glpat-)/i.test(a)) return '***'
  if (/^\w+:\/\/[^@\s/]*:[^@\s/]*@/.test(a)) return a.replace(/:\/\/[^@]*@/, '://***@')
  return a
}

// Redige um servidor para gravação na nuvem (igual ao desktop): args redigidos e
// TODOS os valores de env em branco (a chave permanece; o valor vai pro Vault /
// fica só local). O desktop reidrata os segredos locais no `applyCloudServers`.
export function sanitizeServerForCloud(s: McpServer): McpServer {
  return {
    id: s.id,
    name: s.name,
    command: s.command,
    args: s.args.map(redactArg),
    env: Object.fromEntries(Object.keys(s.env).map((k) => [k, ''])),
    enabled: s.enabled,
  }
}

// --- coerção defensiva do jsonb devolvido pelo Supabase --------------------
// O `config` chega como jsonb (unknown). Coerção garante que a UI nunca quebra
// por um shape inesperado no banco (inclusive shapes legados).

function asBool(v: unknown): boolean {
  return v === true
}
function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function asStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
function asStrRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val
  }
  return out
}

export function mergeGithub(raw: unknown): GithubConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { connected: asBool(o.connected) }
}

export function mergeInternet(raw: unknown): InternetConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // undefined = ligado (mesma semântica do desktop `webSearchEnabled !== false`).
  return { webSearchEnabled: o.webSearchEnabled !== false }
}

function coerceServer(raw: unknown): McpServer | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = asStr(o.id) || crypto.randomUUID()
  const name = asStr(o.name)

  let command = asStr(o.command)
  let args = asStrArray(o.args)
  // Back-compat: shape legado guardava a linha inteira em `command`, sem `args`.
  if (args.length === 0 && command.includes(' ')) {
    const parts = command.split(/\s+/).filter(Boolean)
    command = parts[0] ?? ''
    args = parts.slice(1)
  }

  const env = asStrRecord(o.env)
  const enabled = o.enabled !== false

  return { id, name, command, args, env, enabled }
}

export function mergeMcp(raw: unknown): McpConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const servers = Array.isArray(o.servers)
    ? o.servers.map(coerceServer).filter((s): s is McpServer => s !== null)
    : []
  return { enabled: o.enabled !== false, servers }
}
