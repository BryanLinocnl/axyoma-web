import { getBalances } from '@/lib/supabase-admin'

// SERVER-ONLY: usa a service-role via supabase-admin. Nunca importar no client.

export type CreditErrorBody = { error: { message: string; type: string } }

/**
 * Corpo do 402 quando a reserva é recusada num modelo que a franquia NÃO cobre.
 *
 * Sem isto o usuário vê "créditos esgotados" com 400 de bônus na tela — a
 * mensagem estaria tecnicamente correta (aqueles créditos não servem para este
 * modelo) e completamente inútil. É um ticket de suporte garantido por usuário.
 *
 * A consulta ao saldo discriminado só acontece no caminho de ERRO: nenhuma
 * requisição extra no caminho feliz.
 */
export async function insufficientCreditsError(userId: string): Promise<CreditErrorBody> {
  try {
    const { bonus } = await getBalances(userId)
    if (bonus > 0) {
      return {
        error: {
          message:
            'seus créditos de boas-vindas são uma franquia dos modelos Vertex e não valem neste modelo. ' +
            'Escolha um modelo Vertex, compre créditos ou conecte sua própria chave.',
          type: 'insufficient_credits',
        },
      }
    }
  } catch {
    // Leitura do saldo falhou: cai na mensagem genérica em vez de derrubar o 402.
  }
  return { error: { message: 'créditos esgotados', type: 'insufficient_credits' } }
}
