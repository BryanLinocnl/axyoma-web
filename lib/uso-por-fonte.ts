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

/**
 * Um dia da série do gráfico, com as duas fontes lado a lado.
 *
 * Três métricas porque as fontes não são comparáveis em todas: BYOK tem
 * `creditosByok` sempre 0 — quem paga é a chave do usuário. Só `tokens` e
 * `chamadas` medem a mesma coisa nos dois lados, e é por isso que a métrica é
 * escolhível no gráfico em vez de fixa.
 */
export type PontoDiario = {
  date: string
  creditosAxyoma: number
  creditosByok: number
  tokensAxyoma: number
  tokensByok: number
  chamadasAxyoma: number
  chamadasByok: number
}

/**
 * Um modelo usado, com a fonte que pagou.
 *
 * A tabela "Modelos usados" saía do `usage_log` e por isso listava só o que
 * passa pelo proxy — os modelos rodados com chave própria não apareciam em
 * lugar nenhum, mesmo respondendo por milhões de tokens.
 */
export type UsoModelo = {
  modelo: string
  fonte: UsoFonte['id']
  chamadas: number
  tokens: number
  creditos: number
}

type LinhaRollup = {
  model: string | null
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
): Promise<{ fontes: UsoFonte[]; porDia: PontoDiario[]; porModelo: UsoModelo[] }> {
  const desde = new Date(Date.now() - diasAtras * 864e5).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('usage_daily')
    .select('dia, model, fonte, kind, calls, credits, cost_usd, prompt_tokens, completion_tokens')
    .eq('user_id', userId)
    .gte('dia', desde)
    .order('dia', { ascending: true })

  if (error) throw new Error(error.message)

  const acc = new Map<UsoFonte['id'], UsoFonte>([
    ['axyoma', { id: 'axyoma', label: 'Créditos Axyoma', chamadas: 0, tokens: 0, creditos: 0, custoUsd: 0 }],
    ['byok', { id: 'byok', label: 'Sua chave (BYOK)', chamadas: 0, tokens: 0, creditos: 0, custoUsd: null }],
  ])
  const dias = new Map<string, PontoDiario>()
  const modelos = new Map<string, UsoModelo>()
  const pontoVazio = (date: string): PontoDiario => ({
    date,
    creditosAxyoma: 0, creditosByok: 0,
    tokensAxyoma: 0, tokensByok: 0,
    chamadasAxyoma: 0, chamadasByok: 0,
  })

  for (const l of (data ?? []) as LinhaRollup[]) {
    const fonte = fonteDoKind(l.kind)
    if (!fonte) continue
    const tokens = num(l.prompt_tokens) + num(l.completion_tokens)
    const chamadas = num(l.calls)
    const creditos = num(l.credits)

    const f = acc.get(fonte)!
    f.chamadas += chamadas
    f.tokens += tokens
    f.creditos += creditos
    if (f.custoUsd !== null) f.custoUsd += num(l.cost_usd)

    const d = dias.get(l.dia) ?? pontoVazio(l.dia)
    if (fonte === 'axyoma') {
      d.creditosAxyoma += creditos
      d.tokensAxyoma += tokens
      d.chamadasAxyoma += chamadas
    } else {
      d.creditosByok += creditos
      d.tokensByok += tokens
      d.chamadasByok += chamadas
    }
    dias.set(l.dia, d)

    // Agrupado por (modelo, fonte): o MESMO modelo pode rodar pelos dois lados
    // — com crédito Axyoma num turno e com a chave do usuário no outro. Somar
    // os dois numa linha só esconderia exatamente o que esta tela responde.
    const modelo = l.model ?? '—'
    const chaveModelo = `${modelo}|${fonte}`
    const mm = modelos.get(chaveModelo) ?? { modelo, fonte, chamadas: 0, tokens: 0, creditos: 0 }
    mm.chamadas += chamadas
    mm.tokens += tokens
    mm.creditos += creditos
    modelos.set(chaveModelo, mm)
  }

  // Série CONTÍNUA: dia sem uso vira ponto zerado, não buraco. Sem isto o
  // recharts liga 12/07 direto em 21/07 e a linha inventa um consumo que não
  // houve nos dias do meio.
  const serie: PontoDiario[] = []
  for (let i = diasAtras - 1; i >= 0; i--) {
    const dia = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)
    serie.push(dias.get(dia) ?? pontoVazio(dia))
  }

  return {
    // Só devolve a fonte que TEM uso: um card zerado de BYOK no painel de quem
    // nunca usou chave própria é ruído, não informação.
    fontes: [...acc.values()].filter((f) => f.chamadas > 0 || f.tokens > 0),
    porDia: serie,
    // Ordena por TOKENS, não por créditos: ordenar por crédito jogaria todo
    // modelo BYOK para o fim da lista, já que o crédito dele é zero por
    // definição — que é justamente o defeito que esta mudança corrige.
    porModelo: [...modelos.values()].sort((a, b) => b.tokens - a.tokens || b.chamadas - a.chamadas),
  }
}
