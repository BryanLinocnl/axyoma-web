import { NextResponse, type NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'

// =============================================================================
// Middleware de segurança server-side (Fase 3).
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
// Headers de segurança são aplicados em todas as respostas casadas pelo matcher.
// =============================================================================

const COOKIE = 'axyoma-access-token'

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // TRAVA TEMPORÁRIA: a página de Imagens está oculta/desativada (será publicada
  // depois). O código dela permanece no repo; aqui só bloqueamos o acesso direto
  // e a redirecionamos para o Chat. Para reativar: remova este bloco + volte o
  // item "Imagens" em lib/conta-nav.ts.
  if (req.nextUrl.pathname.startsWith('/conta/playground/imagens')) {
    const url = req.nextUrl.clone()
    url.pathname = '/conta/playground/chat'
    return withSecurityHeaders(NextResponse.redirect(url))
  }

  // PERFORMANCE: só verificamos o token quando a rota exige gate de admin. Para
  // as demais páginas /conta/** não há o que decidir aqui (a própria API revalida
  // o JWT), então evitamos qualquer verificação por navegação.
  if (req.nextUrl.pathname.startsWith('/conta/admin')) {
    const token = req.cookies.get(COOKIE)?.value
    if (token) {
      try {
        const { email } = await verifyAccessToken(token)
        // Gate de admin server-side: só bloqueia com identidade positivamente
        // verificada (evita falso-logout de sessões válidas em localStorage).
        if (!isAdminEmail(email)) {
          const url = req.nextUrl.clone()
          url.pathname = '/conta'
          return withSecurityHeaders(NextResponse.redirect(url))
        }
      } catch {
        // Cookie expirado/inválido: NÃO força logout — cai no gate client-side.
      }
    }
  }

  return withSecurityHeaders(NextResponse.next())
}

// Casa apenas a área logada. Exclui estáticos, _next e rotas de API (que fazem a
// própria verificação de JWT via header Authorization).
export const config = {
  matcher: ['/conta/:path*'],
}
