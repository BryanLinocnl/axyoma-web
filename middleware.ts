import { NextResponse, type NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  type Locale,
} from '@/i18n/routing'

// =============================================================================
// Middleware de segurança server-side (Fase 3) + negociação de idioma (Fase 1
// da spec `multilingue.md`).
//
// Protege `/conta/**` (área logada) e `/conta/admin/**` (painel developer).
//
// MODELO DE SESSÃO / LIMITAÇÃO CONHECIDA:
//   A sessão do Supabase vive no localStorage do browser (client `supabase-js`
//   com `persistSession`), NÃO em cookie httpOnly. Middleware roda no servidor e
//   NÃO enxerga o localStorage — logo, por si só, não consegue autenticar.
//
//   Mitigação: o `ContaProvider` (client) espelha o access token num cookie
//   legível `axyoma-access-token` (Secure, SameSite=Lax) e o mantém sincronizado
//   via `onAuthStateChange` (refresh/logout). Este middleware:
//     * cookie presente E VERIFICADO (jose, mesmo segredo/JWKS do proxy):
//         - rota /conta/admin/** e e-mail não-admin → redireciona para /conta.
//           (ENFORCEMENT SERVER-SIDE real: só dispara com identidade PROVADA.)
//         - caso contrário → segue.
//     * cookie ausente OU expirado/inválido → NÃO redireciona. A sessão real
//       vive no localStorage com refresh token; o cookie é só um espelho de TTL
//       curto. Um espelho expirado NÃO implica sessão morta (o client renova em
//       background) — forçar /login aqui causaria FALSO-LOGOUT. Deixamos o gate
//       client-side (`ContaProvider`) redirecionar quando não há sessão.
//
//   Defesa em profundidade: toda API sensível (admin/metrics, proxy, billing)
//   revalida o JWT server-side via header Authorization, então nenhum dado vaza
//   mesmo no caminho de fall-through.
//
//   O cookie não é downgrade de confidencialidade: o mesmo JWT já está no
//   localStorage (legível por JS). SameSite=Lax + uso apenas para gate de página
//   (nunca para mutação — mutações usam o header Authorization) limitam CSRF.
//
// IDIOMA — por que a negociação é caseira e não o `createMiddleware` do
// next-intl: o middleware pronto assume ser o dono da requisição e devolve a
// resposta ele mesmo, o que atropelaria o gate de admin acima. Encadear os dois
// custa mais leitura do que as ~40 linhas de negociação daqui, e o gate de auth
// é justamente a parte que não pode quebrar em silêncio.
//
//   * TODA página vive sob `app/[locale]/**`, inclusive `/conta`. As decisões
//     antigas (redirect de Imagens, gate de admin) operam sobre o caminho SEM
//     prefixo, então continuam escritas exatamente como antes.
//   * `pt-BR` NÃO aparece na URL: `/docs` é reescrito para `/pt-BR/docs` e
//     `/pt-BR/docs` é redirecionado (308) para `/docs`. Duas URLs para a mesma
//     página é o conteúdo duplicado que o hreflang existe para evitar.
//   * `/conta` não é traduzida (a área logada continua só em português), então
//     qualquer prefixo nela volta para a URL sem prefixo.
//
// Headers de segurança são aplicados em todas as respostas casadas pelo matcher.
// =============================================================================

const COOKIE = 'axyoma-access-token'

// Arquivos de metadado gerados pelo Next (`opengraph-image`, `icon`…) são
// referenciados pela página COM o prefixo do locale já embutido na URL. Se o
// middleware tirasse o prefixo deles, a tag `og:image` apontaria para um 308 —
// e nem todo raspador de preview de link segue redirecionamento.
const METADATA_FILE = /\/(opengraph-image|twitter-image|icon|apple-icon)(-[^/]*)?$/

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

/** Separa `/en/docs` em `{ prefixo: 'en', caminho: '/docs' }`. */
function splitLocale(pathname: string): { prefixo: Locale | null; caminho: string } {
  for (const l of LOCALES) {
    if (pathname === `/${l}`) return { prefixo: l, caminho: '/' }
    if (pathname.startsWith(`/${l}/`)) return { prefixo: l, caminho: pathname.slice(l.length + 1) }
  }
  return { prefixo: null, caminho: pathname }
}

/**
 * Idioma da PRIMEIRA visita, a partir do `Accept-Language`.
 *
 * A regra de desempate importa mais do que parece. Quem não pede nem português
 * nem inglês (o visitante sueco que motivou a spec) recebe **inglês**, não o
 * padrão: o problema que esta fase resolve é justamente alguém abrir a home num
 * idioma que não lê e fechar. Já quem não manda `Accept-Language` nenhum — caso
 * do Googlebot — cai no português, que é onde o SEO já existe. Inverter isso
 * tiraria a home indexada de baixo do rastreador.
 */
function negociar(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE

  const preferencias = header
    .split(',')
    .map((parte) => {
      const [tag, ...params] = parte.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 }
    })
    .filter((p) => p.q > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of preferencias) {
    if (tag === '*') return DEFAULT_LOCALE
    const base = tag.split('-')[0]
    const achado = LOCALES.find(
      (l) => l.toLowerCase() === tag || l.toLowerCase().split('-')[0] === base,
    )
    if (achado) return achado
  }

  // Pediu algo, e não foi nem pt nem en.
  return 'en'
}

function comIdioma(res: NextResponse, locale: Locale): NextResponse {
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  })
  return res
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  if (METADATA_FILE.test(pathname)) return withSecurityHeaders(NextResponse.next())

  const { prefixo, caminho } = splitLocale(pathname)

  const destino = (novoCaminho: string): URL => {
    const url = req.nextUrl.clone()
    url.pathname = novoCaminho
    return url
  }

  // TRAVA TEMPORÁRIA: a página de Imagens está oculta/desativada (será publicada
  // depois). O código dela permanece no repo; aqui só bloqueamos o acesso direto
  // e a redirecionamos para o Chat. Para reativar: remova este bloco + volte o
  // item "Imagens" em lib/conta-nav.ts.
  if (caminho.startsWith('/conta/playground/imagens')) {
    return withSecurityHeaders(NextResponse.redirect(destino('/conta/playground/chat')))
  }

  // PERFORMANCE: só verificamos o token quando a rota exige gate de admin. Para
  // as demais páginas /conta/** não há o que decidir aqui (a própria API revalida
  // o JWT), então evitamos qualquer verificação por navegação.
  if (caminho.startsWith('/conta/admin')) {
    const token = req.cookies.get(COOKIE)?.value
    if (token) {
      try {
        const { email } = await verifyAccessToken(token)
        // Gate de admin server-side: só bloqueia com identidade positivamente
        // verificada (evita falso-logout de sessões válidas em localStorage).
        if (!isAdminEmail(email)) {
          return withSecurityHeaders(NextResponse.redirect(destino('/conta')))
        }
      } catch {
        // Cookie expirado/inválido: NÃO força logout — cai no gate client-side.
      }
    }
  }

  // A área logada não é traduzida: `/en/conta/**` volta para `/conta/**`. Assim
  // o `usePathname()` do shell da conta (breadcrumb, item ativo da sidebar,
  // largura da página de chat) continua vendo os mesmos caminhos de sempre.
  if (caminho.startsWith('/conta')) {
    if (prefixo) return withSecurityHeaders(NextResponse.redirect(destino(caminho), 308))
    return withSecurityHeaders(NextResponse.rewrite(destino(`/${DEFAULT_LOCALE}${caminho}`)))
  }

  // `/pt-BR/x` não existe como URL pública — é a mesma página de `/x`.
  if (prefixo === DEFAULT_LOCALE) {
    return withSecurityHeaders(NextResponse.redirect(destino(caminho), 308))
  }

  // `/en/x` já casa `app/[locale]/x` sem reescrita.
  if (prefixo) return withSecurityHeaders(NextResponse.next())

  const escolhido = req.cookies.get(LOCALE_COOKIE)?.value
  const locale = isLocale(escolhido) ? escolhido : negociar(req.headers.get('accept-language'))
  const sufixo = caminho === '/' ? '' : caminho

  if (locale !== DEFAULT_LOCALE) {
    // Grava a escolha para a próxima visita não pagar outro redirecionamento.
    return comIdioma(
      withSecurityHeaders(NextResponse.redirect(destino(`/${locale}${sufixo}`))),
      locale,
    )
  }

  return withSecurityHeaders(NextResponse.rewrite(destino(`/${DEFAULT_LOCALE}${sufixo}`)))
}

// Casa o site inteiro (a raiz precisa entrar para a negociação de idioma
// acontecer), menos:
//   * `/api/**` — rotas de API fazem a própria verificação de JWT via header
//     Authorization e não têm idioma;
//   * `/_next/**` e `/_vercel/**` — artefatos do framework;
//   * qualquer caminho com ponto — arquivo de `public/` (logos dos provedores,
//     ícones, .well-known). Reescrever esses para `/pt-BR/...` daria 404.
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
