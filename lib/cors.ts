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

const WILDCARD = '*'

function allowList(): string[] {
  return (process.env.CORS_ORIGIN || WILDCARD)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function corsHeaders(req: Request, methods = 'GET, POST, OPTIONS'): Record<string, string> {
  const list = allowList()
  const origin = req.headers.get('origin')
  const permissive = list.includes(WILDCARD)

  let allowOrigin: string
  if (permissive) {
    allowOrigin = origin || WILDCARD
  } else if (origin && list.includes(origin)) {
    allowOrigin = origin
  } else {
    // Origem não reconhecida: devolve a 1ª configurada; se diferir da origem real
    // do browser, o próprio browser bloqueia (não vazamos ACAO curinga).
    allowOrigin = list[0] ?? ''
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': methods,
    Vary: 'Origin',
  }
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin
  return headers
}
