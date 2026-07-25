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
server.stdout.on('data', (b) => process.env.SMOKE_VERBOSE && process.stdout.write(b))
server.stderr.on('data', (b) => process.env.SMOKE_VERBOSE && process.stderr.write(b))

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
} catch (e) {
  add('execução do smoke', false, e.message)
} finally {
  server.kill('SIGTERM')
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FALHOU'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
console.log(failed.length === 0 ? 'SMOKE OK' : `SMOKE FALHOU (${failed.length})`)
process.exit(failed.length === 0 ? 0 : 1)
