'use client'

import { useMemo } from 'react'
import { InfoIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { UsoLogRow } from './types'

// LIMITAÇÃO CONHECIDA (documentada, não inventada): `usage_log` não tem coluna
// `agent_kind` (ou similar) que marque se uma chamada veio do agente principal
// ou de um sub-agent (`spawn_agent` no Axyoma IA Code). A coluna `kind` existente
// marca a ORIGEM/CASO DE USO da chamada, não a hierarquia agente/sub-agent — os
// dois conceitos são independentes hoje. Para ligar este gráfico de verdade,
// seria preciso:
//   1. adicionar uma coluna (ex.: `agent_kind text` ou `parent_session_id uuid`)
//      em `usage_log` via migration, com RLS igual às demais colunas;
//   2. o Axyoma IA Code (desktop) passar esse valor ao registrar o uso (hoje o
//      débito é feito server-side, que não recebe esse dado).
// Sem isso, qualquer segmentação "sub-agent" aqui seria inventada — por isso a
// seção só documenta a limitação e mostra os valores de `kind` já existentes.

// Rótulos amigáveis para os valores brutos de `kind`. NUNCA expor nomes de
// provedor de infra na UI — valores desconhecidos caem em "Outros".
const KIND_LABEL: Record<string, string> = {
  openrouter: 'Geração',
  chat: 'Chat',
  image: 'Imagem',
  generate: 'Geração',
  skill: 'Skill',
  plan_mode: 'Plan Mode',
  code_mode: 'Code Mode',
  design_mode: 'Design Mode',
  purchase: 'Compra',
  bonus: 'Bônus',
}
function labelForKind(k: string): string {
  return KIND_LABEL[k] ?? (k === '—' ? 'Outros' : 'Outros')
}

export function SubAgentSection({ rows }: { rows: UsoLogRow[] }): React.JSX.Element {
  const kinds = useMemo(() => {
    // Agrupa já pelo rótulo amigável (some com o valor cru de provedor).
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = labelForKind(r.kind ?? '—')
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-2">
        <InfoIcon className="text-muted-foreground size-4" />
        <p className="text-sm font-semibold">Modelos como sub-agent</p>
      </div>
      <p className="text-muted-foreground text-sm">
        Dados insuficientes: <code className="font-mono text-xs">usage_log</code> ainda não tem uma coluna que
        marque se a chamada veio do agente principal ou de um sub-agent (ex.: <code className="font-mono text-xs">agent_kind</code>).
        O campo <code className="font-mono text-xs">kind</code> abaixo descreve apenas a origem/caso de uso da chamada, não a hierarquia
        de agentes — por isso não é possível segmentar essa visão sem uma alteração de schema (nova coluna + o Axyoma IA Code passando
        esse dado ao registrar o uso).
      </p>
      {kinds.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {kinds.map(([k, count]) => (
            <Badge key={k} variant="outline" className="font-mono">
              {k} · {count}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  )
}
