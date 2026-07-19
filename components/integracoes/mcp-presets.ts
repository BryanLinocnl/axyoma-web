// Catálogo dos MCPs mais comuns — COPIADO fielmente do desktop
// (Aplication/src/renderer/src/lib/mcp-presets.ts). O usuário preenche só o
// essencial (token, caminho, etc.) e o preset monta command/args/env certos por
// trás. Quem foge desse padrão usa "Personalizado" (comando/args/env crus).
//
// Web ↔ desktop: os presets geram o MESMO shape stdio { command, args, env } que
// o desktop consome direto de `integrations_config` (mcp). Segredos NÃO são
// gravados na nuvem em claro — ver `mcp-connect-modal.tsx`: o valor secreto vai
// para o Vault e a estrutura salva na nuvem é redigida (igual ao desktop).

export type McpField = {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
  helpUrl?: string
  helpLabel?: string
}

export type McpPreset = {
  id: string
  name: string
  description: string
  fields: McpField[]
  build: (values: Record<string, string>) => { command: string; args: string[]; env: Record<string, string> }
}

export const MCP_PRESETS: McpPreset[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Tabelas, migrations, edge functions e logs do seu projeto Supabase.',
    fields: [
      {
        key: 'token',
        label: 'Access Token',
        placeholder: 'sbp_…',
        secret: true,
        helpUrl: 'https://supabase.com/dashboard/account/tokens',
        helpLabel: 'Gerar token',
      },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@supabase/mcp-server-supabase@latest', `--access-token=${v.token}`],
      env: {},
    }),
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repos, issues e pull requests de qualquer conta (além do que já vem nativo no app).',
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        placeholder: 'ghp_…',
        secret: true,
        helpUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=AXYOMA%20AI%20MCP',
        helpLabel: 'Gerar token',
      },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: v.token },
    }),
  },
  {
    id: 'postgres',
    name: 'Postgres',
    description: 'Consultas num banco Postgres via connection string.',
    fields: [
      { key: 'url', label: 'Connection string', placeholder: 'postgresql://usuario:senha@host:5432/banco', secret: true },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', v.url],
      env: {},
    }),
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploys, projetos, logs de build e variáveis de ambiente da sua conta Vercel.',
    // Server oficial da Vercel é remoto (OAuth em mcp.vercel.com). Como o cliente
    // do app é stdio, a ponte `mcp-remote` faz o bridge stdio↔HTTP e abre o
    // navegador pro login OAuth na primeira conexão — sem token pra colar.
    fields: [],
    build: () => ({
      command: 'npx',
      args: ['-y', 'mcp-remote', 'https://mcp.vercel.com'],
      env: {},
    }),
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Ler e enviar mensagens no seu workspace Slack.',
    fields: [
      { key: 'token', label: 'Bot Token', placeholder: 'xoxb-…', secret: true },
      { key: 'teamId', label: 'Team ID', placeholder: 'T0123456' },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      env: { SLACK_BOT_TOKEN: v.token, SLACK_TEAM_ID: v.teamId },
    }),
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Ler e escrever páginas e bancos de dados do seu workspace Notion.',
    fields: [
      {
        key: 'token',
        label: 'Integration Token',
        placeholder: 'ntn_…',
        secret: true,
        helpUrl: 'https://www.notion.so/my-integrations',
        helpLabel: 'Criar integração',
      },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@notionhq/notion-mcp-server'],
      env: { OPENAPI_MCP_HEADERS: JSON.stringify({ Authorization: `Bearer ${v.token}`, 'Notion-Version': '2022-06-28' }) },
    }),
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Navegar na web de verdade: abrir páginas, clicar, preencher e capturar telas.',
    fields: [],
    build: () => ({
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
      env: {},
    }),
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Ler layouts, componentes e estilos dos seus arquivos Figma.',
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        placeholder: 'figd_…',
        secret: true,
        helpUrl: 'https://www.figma.com/developers/api#access-tokens',
        helpLabel: 'Gerar token',
      },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', 'figma-developer-mcp', `--figma-api-key=${v.token}`, '--stdio'],
      env: {},
    }),
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Clientes, pagamentos, produtos e assinaturas da sua conta Stripe.',
    fields: [
      {
        key: 'token',
        label: 'Secret Key',
        placeholder: 'sk_test_…',
        secret: true,
        helpUrl: 'https://dashboard.stripe.com/apikeys',
        helpLabel: 'Ver chaves',
      },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@stripe/mcp', '--tools=all', `--api-key=${v.token}`],
      env: {},
    }),
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Busca na web via API do Brave (independente da busca nativa do app).',
    fields: [
      {
        key: 'token',
        label: 'API Key',
        secret: true,
        helpUrl: 'https://brave.com/search/api/',
        helpLabel: 'Obter chave',
      },
    ],
    build: (v) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: v.token },
    }),
  },
  {
    id: 'memory',
    name: 'Memória',
    description: 'Memória persistente entre conversas (grafo de conhecimento local).',
    fields: [],
    build: () => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      env: {},
    }),
  },
]
