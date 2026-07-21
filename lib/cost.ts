// Cálculo de custo em USD do turno, a partir de tokens + preços por Mtok.
// Preços são SERVER-ONLY (vêm de public.models via model-registry). Este módulo é
// pura aritmética — sem I/O.

/**
 * Erro sinalizando que o modelo não tem preço configurado (input e output <= 0).
 * A ROTA decide o que fazer: recusar o modelo (caso Vertex — evitar geração de
 * graça) ou aplicar MIN_CHARGE_USD. Não decidimos aqui.
 */
export class PriceNotConfiguredError extends Error {
  constructor() {
    super('preço não configurado (input e output <= 0)')
    this.name = 'PriceNotConfiguredError'
  }
}

/** Entrada estrita do cálculo de custo. Tokens e preços são todos por turno. */
export type CostInput = {
  /** Tokens de prompt (entrada). */
  promptTokens: number
  /** Tokens de completion (saída). */
  completionTokens: number
  /** Preço de entrada em USD por 1M tokens. */
  inputPrice: number
  /** Preço de saída em USD por 1M tokens. */
  outputPrice: number
}

/**
 * cost_usd = prompt/1e6 * inputPrice + completion/1e6 * outputPrice.
 *
 * Guard: se AMBOS os preços forem <= 0, LANÇA `PriceNotConfiguredError` — nunca
 * devolve 0 silenciosamente (isso seria geração de graça). Tokens negativos ou
 * não-finitos são tratados como 0.
 */
export function costUsd(input: CostInput): number {
  const { inputPrice, outputPrice } = input
  if (inputPrice <= 0 && outputPrice <= 0) {
    throw new PriceNotConfiguredError()
  }
  const prompt = safeCount(input.promptTokens)
  const completion = safeCount(input.completionTokens)
  const inPrice = Math.max(0, inputPrice)
  const outPrice = Math.max(0, outputPrice)
  return (prompt / 1e6) * inPrice + (completion / 1e6) * outPrice
}

/** Normaliza contagem de tokens: não-finito ou negativo → 0. */
function safeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Variante que NÃO lança: devolve um resultado discriminado. Conveniente pra rota
 * decidir sem try/catch. `configured=false` => preço ausente (custo = 0).
 */
export function tryCostUsd(input: CostInput):
  | { configured: true; costUsd: number }
  | { configured: false; costUsd: 0 } {
  try {
    return { configured: true, costUsd: costUsd(input) }
  } catch (e) {
    if (e instanceof PriceNotConfiguredError) return { configured: false, costUsd: 0 }
    throw e
  }
}
