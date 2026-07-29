import { supabase } from '@/lib/supabase-browser'

/**
 * Uso agregado por FONTE, incluindo o que não passa pelo proxy.
 *
 * POR QUE ISTO EXISTE. A página de Uso lia só `usage_log`, e por isso mostrava
 * apenas o consumo de créditos AXYOMA. O BYOK aparece em dois lugares, porque
 * são dois caminhos de rede diferentes:
 *
 *   kind='byok'       o app fala com o PROXY e o proxy fala com o provedor.
 *                     Quem grava é o proxy (`logByokUsage`), em `usage_log`.
 *   kind='byok_turn'  o app fala DIRETO com o provedor, sem tocar no proxy.
 *                     O proxy não vê a requisição, então quem grava é o app,
 *                     por telemetria, e o destino é `usage_daily`.
 *
 * Medido em 29/07/2026 nesta base: 4 chamadas de `byok` contra 67 de
 * `byok_turn`. Ler só `usage_log` escondia 94% do uso BYOK — e todos os
 * 2,64 milhões de tokens dele.
 *
 * `usage_daily` é o rollup diário e cobre AS DUAS origens (o proxy também
 * agrega para lá), então é a fonte certa para o total. `usage_log` continua
 * sendo a fonte do detalhe linha a linha, que o rollup não guarda.
 */

/** Uma fonte de uso, já somada. */
export type UsoFonte = {
  /** Chave estável para React e para o filtro. */
  id: 'axyoma' | 'byok'
  label: string
  chamadas: number
  tokens: number
  /** Créditos AXYOMA gastos. BYOK é sempre 0 — quem paga é a chave do usuário. */
  creditos: number
  /**
   * Custo em dólar, quando conhecido. No BYOK é `null`, não zero: a cobrança
   * acontece na conta do usuário no provedor, e nós não a medimos. Mostrar
   * "US$ 0,00" afirmaria que foi de graça.
   */
  custoUsd: number | null
}

export type UsoDiario = { dia: string; fonte: UsoFonte['id']; tokens: number; chamadas: number }

type LinhaRollup = {
  dia: string
  fonte: string | null
  kind: string | null
  calls: number | null
  credits: number | string | null
  cost_usd: number | string | null
  prompt_tokens: number | string | null
  completion_tokens: number | string | null
}

/**
 * `kind` do rollup → fonte que o usuário entende.
 *
 * `byok_error` fica DE FORA de propósito: turno que falhou não é uso, e
 * misturá-lo infla a contagem de quem só quer saber quanto usou. Falha é
 * assunto do painel de developer, junto com os logs de erro.
 *
 * `purchase` e `signup_bonus` também saem: são movimentos de saldo, não uso —
 * e o `signup_bonus` entra NEGATIVO no rollup, o que faria o total de créditos
 * gastos diminuir sozinho.
 */
function fonteDoKind(kind: string | null): UsoFonte['id'] | null {
  switch (kind) {
    case 'openrouter':
    case 'vertex':
    case 'image':
    case 'video':
      return 'axyoma'
    case 'byok':
    case 'byok_turn':
      return 'byok'
    default:
      return null
  }
}

const num = (v: number | string | null): number => (v == null ? 0 : Number(v)) || 0

export async function carregarUsoPorFonte(
  userId: string,
  diasAtras = 90,
): Promise<{ fontes: UsoFonte[]; porDia: UsoDiario[] }> {
  const desde = new Date(Date.now() - diasAtras * 864e5).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('usage_daily')
    .select('dia, fonte, kind, calls, credits, cost_usd, prompt_tokens, completion_tokens')
    .eq('user_id', userId)
    .gte('dia', desde)
    .order('dia', { ascending: true })

  if (error) throw new Error(error.message)

  const acc = new Map<UsoFonte['id'], UsoFonte>([
    ['axyoma', { id: 'axyoma', label: 'Créditos Axyoma', chamadas: 0, tokens: 0, creditos: 0, custoUsd: 0 }],
    ['byok', { id: 'byok', label: 'Sua chave (BYOK)', chamadas: 0, tokens: 0, creditos: 0, custoUsd: null }],
  ])
  const dias = new Map<string, UsoDiario>()

  for (const l of (data ?? []) as LinhaRollup[]) {
    const fonte = fonteDoKind(l.kind)
    if (!fonte) continue
    const tokens = num(l.prompt_tokens) + num(l.completion_tokens)
    const chamadas = num(l.calls)

    const f = acc.get(fonte)!
    f.chamadas += chamadas
    f.tokens += tokens
    f.creditos += num(l.credits)
    if (f.custoUsd !== null) f.custoUsd += num(l.cost_usd)

    const chave = `${l.dia}|${fonte}`
    const d = dias.get(chave) ?? { dia: l.dia, fonte, tokens: 0, chamadas: 0 }
    d.tokens += tokens
    d.chamadas += chamadas
    dias.set(chave, d)
  }

  return {
    // Só devolve a fonte que TEM uso: um card zerado de BYOK no painel de quem
    // nunca usou chave própria é ruído, não informação.
    fontes: [...acc.values()].filter((f) => f.chamadas > 0 || f.tokens > 0),
    porDia: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
  }
}
