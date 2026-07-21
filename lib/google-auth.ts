// Autenticação Google Cloud (Vertex AI) via Workload Identity Federation (WIF),
// 100% compatível com o runtime EDGE — fetch puro, sem SDK, sem `crypto` do Node,
// sem chave de Service Account (a org bloqueia chaves SA).
//
// Fluxo (3 passos):
//   1) Obter o token OIDC que a Vercel injeta em runtime (identidade da função).
//   2) Trocar esse OIDC por um "federated token" no Google STS
//      (grant_type=token-exchange).
//   3) Impersonar o Service Account via IAM Credentials (generateAccessToken),
//      obtendo o access_token final usado nas chamadas ao Vertex.
//
// Exporta `getAccessToken(): Promise<string>` com:
//   - cache em memória do módulo (vive enquanto a instância edge estiver quente);
//   - renovação PREEMPTIVA (~5 min antes de expirar);
//   - mutex simples (dedupe de renovação concorrente — 1 refresh por vez);
//   - retry com backoff exponencial em falha de rede/5xx.
//
// SEGURANÇA: NUNCA logar tokens (OIDC, federated ou access_token). Mensagens de
// erro carregam apenas status/código e corpo já sanitizado pelo próprio Google
// (que não ecoa segredos), nunca o token de entrada.

import { getVercelOidcToken } from '@vercel/functions/oidc'

// -----------------------------------------------------------------------------
// Constantes de protocolo (OAuth 2.0 Token Exchange — RFC 8693 — e Google IAM).
// -----------------------------------------------------------------------------
const STS_ENDPOINT = 'https://sts.googleapis.com/v1/token'
const IAM_CREDENTIALS_HOST = 'https://iamcredentials.googleapis.com'
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
const GRANT_TYPE_TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange'
const TOKEN_TYPE_ACCESS_TOKEN = 'urn:ietf:params:oauth:token-type:access_token'
// O token OIDC da Vercel é um JWT assinado -> subject_token_type = jwt.
const TOKEN_TYPE_JWT = 'urn:ietf:params:oauth:token-type:jwt'

// Renovação preemptiva: consideramos o token "vencido" 5 min antes do prazo real.
const RENEW_SKEW_MS = 5 * 60 * 1000
// Tempo de vida solicitado ao impersonar o SA (máx. típico do IAM = 3600s).
const IMPERSONATION_LIFETIME_SECONDS = 3600
// Retry/backoff em falhas transitórias (rede / 429 / 5xx).
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 300

// -----------------------------------------------------------------------------
// Envs de configuração (SERVER-ONLY — nunca prefixadas com NEXT_PUBLIC_).
// -----------------------------------------------------------------------------
/** Service Account a ser impersonado (ex.: vertex@projeto.iam.gserviceaccount.com). */
const GCP_SA_EMAIL = process.env.GCP_SA_EMAIL
/**
 * Audience do provider WIF, no formato:
 *   //iam.googleapis.com/projects/NUM/locations/global/workloadIdentityPools/POOL/providers/PROVIDER
 */
const GCP_WIF_AUDIENCE = process.env.GCP_WIF_AUDIENCE
/** Token OIDC injetado pela Vercel em runtime (fallback quando o pacote não existe). */
const VERCEL_OIDC_TOKEN = process.env.VERCEL_OIDC_TOKEN

// -----------------------------------------------------------------------------
// Tipos estritos.
// -----------------------------------------------------------------------------
/** Access token final + instante de expiração (epoch em ms). */
type CachedToken = {
  readonly accessToken: string
  readonly expiresAtMs: number
}

/** Resposta do STS (RFC 8693). Só usamos `access_token`. */
type StsExchangeResponse = {
  readonly access_token: string
  readonly issued_token_type: string
  readonly token_type: string
  readonly expires_in?: number
}

/** Resposta do IAM Credentials generateAccessToken. */
type GenerateAccessTokenResponse = {
  readonly accessToken: string
  /** RFC 3339 (ex.: "2026-07-21T12:34:56Z"). */
  readonly expireTime: string
}

// -----------------------------------------------------------------------------
// Estado do módulo: cache + mutex de renovação.
// -----------------------------------------------------------------------------
let cachedToken: CachedToken | null = null
/**
 * Promise da renovação em andamento. Serve de mutex: requests concorrentes que
 * chegam durante um refresh aguardam a MESMA promise em vez de dispararem N
 * trocas STS/IAM simultâneas. Zerada ao concluir (sucesso ou falha).
 */
let inFlightRefresh: Promise<CachedToken> | null = null

// -----------------------------------------------------------------------------
// Utilidades internas.
// -----------------------------------------------------------------------------
/** Sleep sem depender de APIs do Node (compatível com edge). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True se o cache existe e ainda está válido considerando o skew preemptivo. */
function isFresh(token: CachedToken | null): token is CachedToken {
  return token !== null && Date.now() < token.expiresAtMs - RENEW_SKEW_MS
}

/**
 * Executa um fetch com retry/backoff exponencial. Repete apenas em erros
 * transitórios: exceção de rede, 429 e 5xx. Erros 4xx (exceto 429) são
 * definitivos (config errada) e sobem imediatamente. NÃO loga corpo de request.
 */
async function fetchWithRetry(url: string, init: RequestInit, contexto: string): Promise<Response> {
  let ultimaFalha: unknown = null

  for (let tentativa = 0; tentativa <= MAX_RETRIES; tentativa++) {
    if (tentativa > 0) {
      // Backoff exponencial com jitter leve para evitar thundering herd.
      const espera = BASE_BACKOFF_MS * 2 ** (tentativa - 1) + Math.floor(Math.random() * 100)
      await sleep(espera)
    }

    let res: Response
    try {
      res = await fetch(url, init)
    } catch (e) {
      // Falha de rede -> transitória, tenta de novo.
      ultimaFalha = e
      continue
    }

    if (res.ok) return res

    // 429 ou 5xx -> transitório; demais 4xx -> definitivo.
    if (res.status === 429 || res.status >= 500) {
      const corpo = await res.text().catch(() => '')
      ultimaFalha = new Error(`${contexto} transitório (${res.status}): ${corpo}`)
      continue
    }

    const corpo = await res.text().catch(() => '')
    throw new Error(`${contexto} falhou (${res.status}): ${corpo}`)
  }

  throw new Error(
    `${contexto} esgotou ${MAX_RETRIES} tentativas: ${
      ultimaFalha instanceof Error ? ultimaFalha.message : String(ultimaFalha)
    }`,
  )
}

// -----------------------------------------------------------------------------
// Passo 1 — Token OIDC da Vercel.
// -----------------------------------------------------------------------------
/**
 * Obtém o token OIDC da identidade da função Vercel via `@vercel/functions/oidc`
 * (getVercelOidcToken). Na Vercel, o token OIDC é POR-REQUEST (injetado no
 * contexto/headers da requisição quando o OIDC Federation está ativo) — NÃO é um
 * env var estático em runtime. Por isso usamos a API oficial; o env
 * `VERCEL_OIDC_TOKEN` só existe no dev local (`vercel env pull`) e fica como
 * fallback. Requer OIDC Federation habilitado no projeto Vercel.
 */
async function getVercelOidc(): Promise<string> {
  try {
    const t = await getVercelOidcToken()
    if (t) return t
  } catch {
    // Ignora e cai no fallback por env — nunca logamos o motivo com token.
  }

  if (VERCEL_OIDC_TOKEN) return VERCEL_OIDC_TOKEN

  throw new Error(
    'Token OIDC da Vercel indisponível: confirme que o OIDC Federation está ATIVO no projeto Vercel (Settings > Security).',
  )
}

// -----------------------------------------------------------------------------
// Passo 2 — Troca OIDC -> federated token (Google STS).
// -----------------------------------------------------------------------------
async function trocarPorFederatedToken(oidcToken: string): Promise<string> {
  if (!GCP_WIF_AUDIENCE) throw new Error('GCP_WIF_AUDIENCE ausente')

  // STS espera application/x-www-form-urlencoded (RFC 8693).
  const body = new URLSearchParams({
    grant_type: GRANT_TYPE_TOKEN_EXCHANGE,
    audience: GCP_WIF_AUDIENCE,
    scope: CLOUD_PLATFORM_SCOPE,
    requested_token_type: TOKEN_TYPE_ACCESS_TOKEN,
    subject_token: oidcToken,
    subject_token_type: TOKEN_TYPE_JWT,
  })

  const res = await fetchWithRetry(
    STS_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    'STS token-exchange',
  )

  const json = (await res.json()) as StsExchangeResponse
  if (!json.access_token) throw new Error('STS não retornou access_token')
  return json.access_token
}

// -----------------------------------------------------------------------------
// Passo 3 — Impersonar o SA (IAM Credentials) -> access_token final.
// -----------------------------------------------------------------------------
async function impersonarServiceAccount(federatedToken: string): Promise<CachedToken> {
  if (!GCP_SA_EMAIL) throw new Error('GCP_SA_EMAIL ausente')

  // O ':' do método precisa ficar literal na URL (não pode ser encodado).
  const url = `${IAM_CREDENTIALS_HOST}/v1/projects/-/serviceAccounts/${encodeURIComponent(
    GCP_SA_EMAIL,
  )}:generateAccessToken`

  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${federatedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: [CLOUD_PLATFORM_SCOPE],
        lifetime: `${IMPERSONATION_LIFETIME_SECONDS}s`,
      }),
    },
    'IAM generateAccessToken',
  )

  const json = (await res.json()) as GenerateAccessTokenResponse
  if (!json.accessToken || !json.expireTime) {
    throw new Error('IAM generateAccessToken não retornou accessToken/expireTime')
  }

  const expiresAtMs = Date.parse(json.expireTime)
  return {
    accessToken: json.accessToken,
    // Se o parse falhar por algum motivo, cai no lifetime solicitado.
    expiresAtMs: Number.isFinite(expiresAtMs)
      ? expiresAtMs
      : Date.now() + IMPERSONATION_LIFETIME_SECONDS * 1000,
  }
}

/** Executa o fluxo completo (OIDC -> STS -> IAM) e devolve o token com validade. */
async function renovarToken(): Promise<CachedToken> {
  const oidc = await getVercelOidc()
  const federated = await trocarPorFederatedToken(oidc)
  const token = await impersonarServiceAccount(federated)
  cachedToken = token
  return token
}

// -----------------------------------------------------------------------------
// API pública.
// -----------------------------------------------------------------------------
/**
 * Retorna um access_token válido do Google Cloud para chamar o Vertex AI.
 * Usa cache em memória; renova preemptivamente (~5 min antes de expirar) e
 * deduplica renovações concorrentes via mutex (inFlightRefresh).
 */
export async function getAccessToken(): Promise<string> {
  // Caminho quente: token em cache ainda fresco.
  if (isFresh(cachedToken)) return cachedToken.accessToken

  // Já há um refresh em andamento? Aguarda o mesmo (mutex/dedupe).
  if (inFlightRefresh) {
    const t = await inFlightRefresh
    return t.accessToken
  }

  // Inicia o refresh e publica a promise para os concorrentes reaproveitarem.
  inFlightRefresh = renovarToken()
  try {
    const t = await inFlightRefresh
    return t.accessToken
  } finally {
    // Libera o mutex independentemente de sucesso/erro.
    inFlightRefresh = null
  }
}

/**
 * Descarta o cache em memória (útil em testes ou após um 401 do upstream para
 * forçar nova troca no próximo `getAccessToken`).
 */
export function invalidateAccessToken(): void {
  cachedToken = null
}
