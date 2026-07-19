// Tipos compartilhados do Chat (P5). Espelham as tabelas `chat_conversations` e
// `chat_messages` (ver supabase/migrations/20260718_dashboard_foundation.sql).

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  // `id` é o UUID do banco quando persistida; mensagens em voo usam um id local.
  id: string
  role: ChatRole
  content: string
  // Marca a mensagem do assistente que está recebendo tokens do stream.
  streaming?: boolean
  // Erro de turno (ex.: 402 saldo, falha de rede) para exibir inline.
  error?: string
}

export interface Conversation {
  id: string
  title: string | null
  model: string | null
  created_at: string
  updated_at: string
}

export interface ModelOption {
  id: string
  name: string
}
