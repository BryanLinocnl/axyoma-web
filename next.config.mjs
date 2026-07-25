/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // A CSP entra em REPORT-ONLY de propósito: o app usa estilos inline do
  // Tailwind/Recharts e a lista de origens (Supabase, Vercel) varia por ambiente.
  // Report-only mede o estrago antes de bloquear; promover a `Content-Security-Policy`
  // depois de checar o relatório é uma linha.
  async headers() {
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline'/'unsafe-eval' ainda são necessários: Next injeta bootstrap
      // inline e o dev usa eval. Ao promover para enforcing, trocar por nonce.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Supabase (REST/Storage/Realtime) + o próprio deploy.
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
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
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
