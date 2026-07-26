// Smoke test de runtime do site/proxy. Sobe o build de produção (`next start`) e
// verifica o que só existe quando o servidor está de pé: headers de segurança,
// gates de autenticação e CORS.
//
// Existe pelo mesmo motivo do smoke do desktop: as duas regressões recentes do
// proxy (CORS fail-closed derrubando o app, rota de catálogo aberta) passaram por
// type-check e build verdes.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = process.env.SMOKE_PORT ?? '3111'
const BASE = `http://127.0.0.1:${PORT}`
const checks = []
const add = (name, ok, detail) => checks.push({ name, ok, detail })

const server = spawn('npx', ['next', 'start', '-p', PORT], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
})
// O log do servidor é ACUMULADO (não só ecoado): é nele que a checagem de
// vazamento da chave BYOK procura. Um segredo que aparece aqui apareceria no
// painel da Vercel em texto puro.
let serverLog = ''
server.stdout.on('data', (b) => { serverLog += b; if (process.env.SMOKE_VERBOSE) process.stdout.write(b) })
server.stderr.on('data', (b) => { serverLog += b; if (process.env.SMOKE_VERBOSE) process.stderr.write(b) })

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) })
      if (r.ok || r.status < 500) return true
    } catch {
      /* ainda subindo */
    }
    await sleep(1000)
  }
  return false
}

try {
  const up = await waitUp()
  add('servidor sobe', up)
  if (!up) throw new Error('servidor não respondeu')

  // 1. Headers de segurança em página PÚBLICA. Antes existiam só no middleware,
  //    cujo matcher é /conta/** — landing e /login saíam sem nada.
  const home = await fetch(BASE)
  const h = home.headers
  add('X-Frame-Options em página pública', h.get('x-frame-options') === 'DENY', h.get('x-frame-options') ?? '(ausente)')
  add('nosniff em página pública', h.get('x-content-type-options') === 'nosniff')
  add('HSTS presente', Boolean(h.get('strict-transport-security')))
  // Enforcing, não report-only: report-only não bloqueia nada.
  add('CSP em enforcing', Boolean(h.get('content-security-policy')), h.get('content-security-policy') ? 'ok' : (h.get('content-security-policy-report-only') ? 'só report-only' : '(ausente)'))
  add(
    'CSP nega frame-ancestors e object-src',
    /frame-ancestors 'none'/.test(h.get('content-security-policy') ?? '') &&
      /object-src 'none'/.test(h.get('content-security-policy') ?? ''),
  )

  // 2. Rotas que gastam dinheiro ou expõem preço NÃO podem responder sem JWT.
  for (const [path, method] of [
    ['/api/v1/models', 'GET'],
    ['/api/v1/chat/completions', 'POST'],
    ['/api/v1/images', 'POST'],
    ['/api/v1/videos', 'POST'],
    ['/api/v1/search', 'POST'],
    ['/api/v1/credits/bootstrap', 'POST'],
    ['/api/translate', 'POST'],
    ['/api/billing/config', 'GET'],
    ['/api/admin/metrics', 'GET'],
  ]) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? '{}' : undefined,
    })
    add(`${method} ${path} exige autenticação`, res.status === 401, `HTTP ${res.status}`)
  }

  // 3. O cron não pode ser disparado sem o segredo.
  const cron = await fetch(BASE + '/api/models/news/refresh', { method: 'POST' })
  add('refresh de notícias exige CRON_SECRET', cron.status === 401, `HTTP ${cron.status}`)

  // 4. CORS: o desktop roda em file://, cuja origem é OPACA — o browser manda
  //    `Origin: null`. Foi exatamente isso que quebrou o catálogo quando o
  //    default virou fail-closed.
  const pre = await fetch(BASE + '/api/v1/models', {
    method: 'OPTIONS',
    headers: { Origin: 'null', 'Access-Control-Request-Method': 'GET' },
  })
  add(
    'CORS aceita Origin: null (desktop empacotado)',
    pre.headers.get('access-control-allow-origin') === '*',
    pre.headers.get('access-control-allow-origin') ?? '(ausente)',
  )

  // O renderer em DESENVOLVIMENTO roda no dev server do Vite, não em file://.
  // Sem isto, o app de dev fica sem catálogo de modelos e sem bootstrap de
  // créditos — e o erro aparece como "Failed to fetch", que não diz nada.
  const dev = await fetch(BASE + '/api/v1/models', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
  })
  add(
    'CORS aceita loopback (desktop em dev)',
    dev.headers.get('access-control-allow-origin') === 'http://localhost:5173',
    dev.headers.get('access-control-allow-origin') ?? '(ausente)',
  )
  // ── BYOK: a chave do usuário trafega por header a cada requisição ─────────
  // O risco do BYOK não é o fio (HTTPS), é o NOSSO log e o NOSSO corpo de erro.
  // Estas checagens existem porque nenhuma delas falha em type-check ou build.
  const CHAVE_FALSA = 'sk-or-v1-CHAVEDESMOKE00000000000000000000'

  // 1. Sem isto o preflight do browser derruba a requisição antes de ela sair.
  const preByok = await fetch(BASE + '/api/v1/chat/completions', {
    method: 'OPTIONS',
    headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST' },
  })
  const allowHdr = (preByok.headers.get('access-control-allow-headers') || '').toLowerCase()
  add('CORS libera o header da chave BYOK', allowHdr.includes('x-axyoma-provider-key'), allowHdr || '(ausente)')

  // 2. A chave do fornecedor NÃO é credencial de acesso ao proxy. Se um dia
  //    passar a valer como autenticação, qualquer um com uma chave da OpenRouter
  //    entra na conta de outro.
  const byokSemJwt = await fetch(BASE + '/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Axyoma-Provider-Key': CHAVE_FALSA },
    body: JSON.stringify({ model: 'anthropic/claude-opus-4.8', messages: [{ role: 'user', content: 'oi' }] }),
  })
  add('chave BYOK não substitui o JWT', byokSemJwt.status === 401, `HTTP ${byokSemJwt.status}`)

  // 3. BYOK não pode ser barrado por modelo: a tabela `public.models` é sobre o
  //    NOSSO roteamento, e um Gemini pedido com a chave do usuário é servido
  //    pela OpenRouter. Se voltar a resolver a tabela em BYOK, este teste cai
  //    (o 400 de "byok_not_supported" apareceria antes do 401 de auth).
  const byokGemini = await fetch(BASE + '/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Axyoma-Provider-Key': CHAVE_FALSA },
    body: JSON.stringify({ model: 'google/gemini-2.5-pro', messages: [{ role: 'user', content: 'oi' }] }),
  })
  add('BYOK não é recusado por modelo do Google', byokGemini.status !== 400, `HTTP ${byokGemini.status}`)

  // Entitlements: a rota que decide o que cada um pode usar. Sem JWT tem que
  // ser 401 — nunca um objeto de recursos. Se um dia responder 200 com features
  // para requisição anônima, é produto pago liberado de graça.
  const ent = await fetch(BASE + '/api/v1/entitlements')
  add('entitlements exige autenticação', ent.status === 401, `HTTP ${ent.status}`)
  const entBody = await ent.text()
  add('entitlements não vaza features sem auth', !entBody.includes('design'), entBody.slice(0, 100))

  // 4. e 5. A chave não pode voltar ao cliente nem parar no log.
  const corpoByok = await byokSemJwt.text()
  add('chave BYOK não ecoa no corpo da resposta', !corpoByok.includes(CHAVE_FALSA), corpoByok.slice(0, 100))
  await new Promise((r) => setTimeout(r, 500))
  add('chave BYOK não aparece no log do servidor', !serverLog.includes(CHAVE_FALSA), '(rode com SMOKE_VERBOSE=1)')
} catch (e) {
  add('execução do smoke', false, e.message)
} finally {
  server.kill('SIGTERM')
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FALHOU'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
console.log(failed.length === 0 ? 'SMOKE OK' : `SMOKE FALHOU (${failed.length})`)
process.exit(failed.length === 0 ? 0 : 1)
