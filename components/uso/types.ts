// Shape mínima de uma linha de usage_log usada pelas páginas de Uso.
// Colunas confirmadas no banco: ts, model, kind, credits, prompt_tokens,
// completion_tokens, user_id. NÃO existem colunas `project` nem `agent_kind`
// — por isso não é possível segmentar "por projeto" ou "sub-agent" a partir
// do schema atual (ver <SubAgentSection />).
export type UsoLogRow = {
  ts: string
  model: string | null
  kind: string | null
  credits: number
  prompt_tokens: number
  completion_tokens: number
}
