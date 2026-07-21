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
}

export default nextConfig
