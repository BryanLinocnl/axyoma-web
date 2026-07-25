/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pasta de saída. Existe como env porque `next dev` e `next build` gravam no
  // MESMO `.next` por padrão: rodar um build enquanto alguém está com o dev
  // server aberto apaga os chunks que o navegador dele está referenciando, e a
  // aba quebra com ChunkLoadError ou perde a folha de estilos.
  //
  // Para verificar um build sem atrapalhar quem está desenvolvendo:
  //   NEXT_DIST_DIR=.next-verify npm run build
  //   NEXT_DIST_DIR=.next-verify npm run start -- -p 4311
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // O proxy é um Route Handler em runtime edge.
  reactStrictMode: true,
  webpack: (config) => {
    // `@vercel/functions/oidc` só re-exporta um provider de credenciais AWS que
    // depende de `@aws-sdk/credential-provider-web-identity` (peer OPCIONAL).
    // Nós usamos apenas getVercelOidcToken (fluxo GCP/WIF) — nunca o caminho AWS.
    // Marcar como módulo vazio evita "Module not found" no build sem instalar o
    // SDK da AWS (que nunca é executado em runtime).
    config.resolve = config.resolve || {}
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      '@aws-sdk/credential-provider-web-identity': false,
    }
    return config
  },

  // Headers de segurança GLOBAIS (auditoria M-1). Antes só existiam no
  // middleware, cujo matcher é `/conta/:path*` — landing, /login, /signup,
  // /docs, /download e as rotas de API saíam sem nada. `/login` sem
  // X-Frame-Options é clickjacking de credencial, e sem CSP qualquer XSS futuro
  // em página pública teria exfiltração livre.
  //
  // A CSP está em ENFORCING. Ela é deliberadamente permissiva onde o Next exige
  // ('unsafe-inline'/'unsafe-eval' no script-src, por causa do bootstrap inline;
  // 'unsafe-inline' no style-src, por causa de Tailwind/Recharts) — o que ela
  // fecha de verdade é o resto: nada de <script> de host externo além do captcha,
  // sem plugin/object, sem <base> injetada, sem ser enquadrada em iframe alheio.
  // Conferido antes de ligar: as fontes são self-hosted (next/font) e não há
  // script, iframe ou fonte externa no código.
  //
  // Para endurecer mais adiante: trocar 'unsafe-inline' por nonce no script-src
  // (exige middleware gerando o nonce por requisição).
  async headers() {
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline'/'unsafe-eval' ainda são necessários: Next injeta bootstrap
      // inline e o dev usa eval. Ao promover para enforcing, trocar por nonce.
      // challenges.cloudflare.com: widget do Turnstile (captcha do login/cadastro).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Supabase (REST/Storage/Realtime) + o próprio deploy.
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      // O Turnstile roda dentro de um iframe próprio.
      "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Next pode criar worker de blob em alguns caminhos; sem isto cairia no
      // default-src e quebraria em enforcing.
      "worker-src 'self' blob:",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
