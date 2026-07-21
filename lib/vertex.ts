// Adaptador Vertex AI — flavor OpenAI (endpoint openapi/chat/completions).
// CONFIRMADO por chamada real: formato 100% OpenAI, streaming com
// stream_options.include_usage=true, e o `usage` vem NO chunk final (o que tem
// finish_reason). NÃO existe campo 'cost' na resposta — custo é calculado por nós.
//
// SERVER-ONLY: usa o access token (WIF/OIDC) e a region JÁ VALIDADA pelo
// model-registry (anti-SSRF). Não valida region de novo aqui — quem chama garante.
// Só use dentro de rotas/handlers server (mesmo padrão do `supabase-admin.ts`).

/**
 * Usage do turno, extraído do chunk final do SSE.
 * `completion_tokens` aqui é a SAÍDA COBRÁVEL (inclui reasoning/thinking tokens,
 * que o Google cobra como saída mas não põe em completion_tokens) — ver
 * usageFromDataPayload.
 */
export type VertexUsage = {
  prompt_tokens: number
  completion_tokens: number
}

/**
 * Monta a URL do endpoint OpenAI-compat do Vertex.
 *
 * - `location === 'global'` → host SEM prefixo regional ('aiplatform.googleapis.com').
 * - qualquer outra location → host regional ('{location}-aiplatform.googleapis.com').
 *
 * A `location` DEVE vir já validada contra a allowlist (ver model-registry). Ela é
 * interpolada no host, então tratá-la como confiável aqui é intencional.
 */
export function buildVertexUrl(location: string, projectId: string): string {
  const loc = location.trim()
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${projectId}/locations/${loc}/endpoints/openapi/chat/completions`
}

/** Corpo OpenAI genérico do client (não tipamos todos os campos de propósito). */
type OpenAIChatBody = Record<string, unknown> & {
  model?: unknown
  stream?: unknown
  stream_options?: Record<string, unknown>
  usage?: unknown
}

/**
 * Reescreve o corpo do client para o formato aceito pelo Vertex:
 * - `model` = upstream_model_id (id real no Vertex).
 * - `stream` = true (sempre streamamos; o dreno depende disso).
 * - `stream_options.include_usage` = true (pra receber o usage no chunk final).
 * - remove `usage` (ex.: `usage:{include:true}` estilo OpenRouter) — não existe no Vertex.
 * Não muta o objeto original.
 */
export function rewriteBodyForVertex(clientBody: OpenAIChatBody, upstreamModelId: string): OpenAIChatBody {
  const { usage: _drop, stream_options: prevStreamOpts, ...rest } = clientBody
  return {
    ...rest,
    model: upstreamModelId,
    stream: true,
    stream_options: { ...(prevStreamOpts ?? {}), include_usage: true },
  }
}

export type CallVertexParams = {
  /** Location/region JÁ VALIDADA (vira o host). */
  region: string
  /** id real do modelo no Vertex. */
  upstreamModelId: string
  /** Corpo OpenAI vindo do client (será reescrito, não mutado). */
  body: OpenAIChatBody
  /** Access token OIDC/WIF (Bearer). */
  accessToken: string
  /** Projeto GCP; default = env GCP_PROJECT_ID. */
  projectId?: string
  /**
   * AbortSignal do upstream. IMPORTANTE: o dreno do SSE é DESACOPLADO do client,
   * então normalmente NÃO se passa o signal do request do client aqui — só um
   * signal próprio (timeout) se desejado. Débito acontece sempre.
   */
  signal?: AbortSignal
}

/**
 * Faz a chamada streaming ao Vertex e DEVOLVE o `Response` cru (não consome o
 * body). Quem chama é responsável por drenar o SSE. Não lança em status !=2xx —
 * devolve o Response pra rota decidir (o formato de resposta ao client é sempre
 * OpenAI/SSE).
 */
export async function callVertex(params: CallVertexParams): Promise<Response> {
  const projectId = params.projectId ?? process.env.GCP_PROJECT_ID
  if (!projectId) throw new Error('GCP_PROJECT_ID ausente')
  if (!params.region) throw new Error('region ausente para chamada Vertex')

  const url = buildVertexUrl(params.region, projectId)
  const body = rewriteBodyForVertex(params.body, params.upstreamModelId)

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: params.signal,
  })
}

/**
 * Parseia UM payload `data:` do SSE (o JSON já sem o prefixo "data: ") e devolve
 * o usage se presente. Retorna null se não for JSON válido, for '[DONE]', ou não
 * tiver usage. Útil pra inspecionar chunk a chunk durante o dreno.
 */
export function usageFromDataPayload(payload: string): VertexUsage | null {
  const trimmed = payload.trim()
  if (!trimmed || trimmed === '[DONE]') return null
  try {
    const obj = JSON.parse(trimmed) as {
      usage?: {
        prompt_tokens?: unknown
        completion_tokens?: unknown
        total_tokens?: unknown
        completion_tokens_details?: { reasoning_tokens?: unknown }
      }
    }
    const u = obj.usage
    if (!u) return null
    const prompt = finiteOrNull(u.prompt_tokens)
    const completion = finiteOrNull(u.completion_tokens)
    const total = finiteOrNull(u.total_tokens)
    const reasoning = finiteOrNull(u.completion_tokens_details?.reasoning_tokens)
    if (prompt === null && completion === null && total === null) return null
    const p = prompt ?? 0
    // COBRANÇA (confirmado por chamada real): o Google cobra os tokens de
    // reasoning/thinking como SAÍDA, mas eles NÃO entram em `completion_tokens`
    // (ex.: completion_tokens=2, reasoning_tokens=34, total_tokens=prompt+36).
    // Usar só completion_tokens subcobraria. `total_tokens - prompt_tokens` captura
    // toda a saída (completion + reasoning). Fallback: completion + reasoning.
    const billableCompletion =
      total !== null && total >= p ? total - p : (completion ?? 0) + (reasoning ?? 0)
    return { prompt_tokens: p, completion_tokens: billableCompletion }
  } catch {
    return null
  }
}

/** Converte para number finito e > 0, senão null. */
function finiteOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// ---------------------------------------------------------------------------
// Geração de IMAGEM — endpoint NATIVO generateContent (api_flavor 'gemini_image').
// NÃO é o openapi/chat/completions (esse é texto). Aqui o corpo/resposta são o
// formato nativo do Gemini no Vertex: contents[].parts[] com inlineData base64.
// ---------------------------------------------------------------------------

/**
 * Monta a URL do endpoint nativo `:generateContent` do Vertex (geração de imagem).
 *
 * - `location === 'global'` → host SEM prefixo regional ('aiplatform.googleapis.com').
 * - qualquer outra location → host regional ('{location}-aiplatform.googleapis.com').
 *
 * A `location` DEVE vir já validada contra a allowlist (ver model-registry). Ela é
 * interpolada no host, então tratá-la como confiável aqui é intencional (anti-SSRF
 * fica a cargo de quem resolve o modelo).
 */
export function buildGenerateContentUrl(
  location: string,
  projectId: string,
  upstreamModelId: string,
  publisher = 'google',
): string {
  const loc = location.trim()
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`
  // O generateContent usa `publishers/{publisher}/models/{ID BARE}`. O
  // upstream_model_id da tabela vem no estilo openapi ('google/gemini-...') — se
  // deixássemos o prefixo do publisher, o path duplicaria ('.../models/google/gemini-...')
  // e a Vertex responde 404. Removemos o prefixo `{publisher}/` quando presente.
  const prefix = `${publisher}/`
  const modelId = upstreamModelId.startsWith(prefix) ? upstreamModelId.slice(prefix.length) : upstreamModelId
  return `https://${host}/v1/projects/${projectId}/locations/${loc}/publishers/${publisher}/models/${modelId}:generateContent`
}

/** Uma imagem inline extraída da resposta generateContent. `data` é base64 cru. */
export type InlineImage = {
  mimeType: string
  /** base64 (sem prefixo data:). */
  data: string
}

/**
 * Extrai TODAS as imagens inline de uma resposta `:generateContent` (não streaming).
 * Varre candidates[].content.parts[] e coleta cada part com `inlineData` (tolera
 * também `inline_data` snake_case por robustez). Parts de texto são ignoradas.
 * Nunca lança: entrada malformada → array vazio.
 */
export function extractInlineImages(data: unknown): InlineImage[] {
  const out: InlineImage[] = []
  const candidates = (data as { candidates?: unknown })?.candidates
  if (!Array.isArray(candidates)) return out
  for (const cand of candidates) {
    const parts = (cand as { content?: { parts?: unknown } })?.content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      const inline =
        (part as { inlineData?: unknown })?.inlineData ?? (part as { inline_data?: unknown })?.inline_data
      if (!inline || typeof inline !== 'object') continue
      const raw = (inline as { data?: unknown }).data
      if (typeof raw !== 'string' || raw.length === 0) continue
      const mime =
        (inline as { mimeType?: unknown }).mimeType ?? (inline as { mime_type?: unknown }).mime_type
      out.push({ data: raw, mimeType: typeof mime === 'string' && mime.length > 0 ? mime : 'image/png' })
    }
  }
  return out
}

/**
 * Extrai o usage do ÚLTIMO chunk que o contém, a partir de um buffer/texto SSE
 * acumulado. Varre todas as linhas `data:` e retorna o último usage encontrado
 * (o chunk final com finish_reason). Retorna null se nenhum chunk trouxe usage.
 */
export function extractUsageFromSSE(sseText: string): VertexUsage | null {
  let last: VertexUsage | null = null
  for (const rawLine of sseText.split('\n')) {
    const line = rawLine.trimStart()
    if (!line.startsWith('data:')) continue
    const usage = usageFromDataPayload(line.slice('data:'.length))
    if (usage) last = usage
  }
  return last
}
