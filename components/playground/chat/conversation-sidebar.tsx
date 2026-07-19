'use client'

import { Plus, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Conversation } from './types'

// Painel lateral de conversas (estilo claude.ai): nova conversa + histórico do
// usuário, com destaque na conversa ativa e ação de excluir no hover.
export function ConversationSidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[]
  activeId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}): React.JSX.Element {
  return (
    <aside className="border-border bg-card/20 flex h-full w-64 shrink-0 flex-col border-r">
      <div className="p-3">
        <button
          onClick={onNew}
          className="border-border hover:bg-muted flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" />
          Nova conversa
        </button>
      </div>
      <div className="text-muted-foreground px-4 pb-1 text-xs font-medium">Histórico</div>
      <ScrollArea className="flex-1 px-2 pb-2">
        {loading ? (
          <div className="text-muted-foreground px-2 py-4 text-xs">Carregando…</div>
        ) : conversations.length === 0 ? (
          <div className="text-muted-foreground px-2 py-4 text-xs">Nenhuma conversa ainda.</div>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id}>
                <div
                  className={cn(
                    'group/item flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    c.id === activeId ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  <button onClick={() => onSelect(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="truncate">{c.title || 'Nova conversa'}</span>
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100"
                    aria-label="Excluir conversa"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  )
}
