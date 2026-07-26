// CORS centralizado para as rotas de API (proxy LLM, imagens, modelos, feed,
// billing, integrações). Substitui o antigo `Access-Control-Allow-Origin: *`
// hard-coded em cada rota por uma ALLOW-LIST configurável.
//
// Configuração — env `CORS_ORIGIN`:
//   * lista separada por vírgula das origens permitidas (web app + desktop).
//     Ex.: `https://axyoma-ai.app,https://www.axyoma-ai.app,app://axyoma`.
//   * se contiver `*` (ou estiver ausente) → modo permissivo (compat legado):
//     reflete a origem do request, ou `*` quando não há Origin.
//
// Comportamento restrito (recomendado em produção):
//   * reflete a origem SOMENTE quando ela está na allow-list (com `Vary: Origin`
//     para o cache não misturar respostas de origens diferentes);
//   * origem desconhecida → devolve a 1ª origem configurada, então o browser
//     BLOQUEIA a resposta cross-origin (fail-closed no lado do browser).
//
// Nota desktop (Electron): requests do processo main (Node) NÃO enviam `Origin`,
// logo CORS não se aplica a eles. Só o renderer envia `Origin` — inclua a origem
// do renderer na allow-list se ele bater direto no proxy.

import { PROVIDER_KEY_HEADER } from '@/lib/byok'

const WILDCARD = '*'

/** `http://localhost:PORT` e `http://127.0.0.1:PORT` (dev do app desktop e do site). */
function isLoopbackOrigin(origin: string | null): boolean {
  if (!origin) return false
  try {
    const u = new URL(origin)
    return (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]')
    )
  } catch {
    return false
  }
}

// Default quando `CORS_ORIGIN` não está definida (auditoria B-4).
//
// Antes o default era `*`: qualquer site aberto no navegador do usuário podia
// chamar estas rotas com o JWT dele (se conseguisse o token) e, principalmente,
// ler a resposta — inclusive as rotas que GASTAM crédito. "Esqueci de setar a
// env" não pode ser o modo mais permissivo.
//
// O default agora é a própria origem do deploy (o site é o único cliente de
// browser que precisa de CORS). O desktop chama do processo main, que não manda
// `Origin` — CORS não se aplica a ele, então isso não quebra o app.
function defaultOrigins(): string[] {
  const out: string[] = []
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) out.push(site.replace(/\/+$/, ''))
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercel) out.push(`https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`)
  return out
}

function allowList(): string[] {
  const configured = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (configured.length > 0) return configured
  return defaultOrigins()
}

export function corsHeaders(req: Request, methods = 'GET, POST, OPTIONS'): Record<string, string> {
  const list = allowList()
  const origin = req.headers.get('origin')
  const permissive = list.includes(WILDCARD)

  let allowOrigin: string
  if (permissive) {
    allowOrigin = origin || WILDCARD
  } else if (isLoopbackOrigin(origin)) {
    // DESKTOP EM DESENVOLVIMENTO: o renderer roda no dev server do Vite
    // (`http://localhost:5173`), não em `file://`. Com o default fail-closed, a
    // resposta vinha com a origem do site e o browser bloqueava tudo — catálogo
    // de modelos e bootstrap de créditos morriam com "Failed to fetch", que é
    // como o Chromium reporta bloqueio de CORS.
    //
    // Loopback é seguro pelo mesmo motivo do `null`: estas rotas autenticam por
    // Bearer no header, não por cookie. Sem `credentials: 'include'`, refletir a
    // origem não expõe sessão de ninguém — e quem já está em `localhost` da
    // máquina do usuário tem caminhos bem melhores que CORS.
    allowOrigin = origin as string
  } else if (origin === 'null') {
    // DESKTOP: o renderer do app empacotado é carregado por `file://`, origem
    // OPACA — o Chromium manda literalmente `Origin: null`. Não dá para pôr isso
    // numa allow-list de host, e devolver a origem do site faria o browser
    // BLOQUEAR (foi o que aconteceu quando o default virou fail-closed: o
    // catálogo de modelos e o bootstrap de créditos do desktop pararam).
    //
    // `*` é seguro aqui: a autenticação destas rotas é Bearer no header, não
    // cookie — sem `credentials: 'include'`, `*` não expõe sessão de ninguém, e
    // uma origem web de verdade continua tendo que estar na allow-list.
    allowOrigin = WILDCARD
  } else if (origin && list.includes(origin)) {
    allowOrigin = origin
  } else {
    // Origem não reconhecida: devolve a 1ª configurada; se diferir da origem real
    // do browser, o próprio browser bloqueia (não vazamos ACAO curinga).
    allowOrigin = list[0] ?? ''
  }

  const headers: Record<string, string> = {
    // O header da chave BYOK precisa estar aqui, senão o preflight do browser
    // derruba a requisição inteira antes de ela sair.
    'Access-Control-Allow-Headers': `authorization, content-type, ${PROVIDER_KEY_HEADER}`,
    'Access-Control-Allow-Methods': methods,
    Vary: 'Origin',
  }
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin
  return headers
}
