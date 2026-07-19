'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { Markdown } from './markdown'
import type { ChatMessage } from './types'

// Thread de mensagens. Auto-scroll para o fim enquanto responde; bolha do usuário
// à direita, resposta do assistente com a marca Axyoma à esquerda.
export function MessageList({ messages, sending }: { messages: ChatMessage[]; sending: boolean }): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-1 py-6">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="ax-rise flex justify-end">
            <div className="bg-muted text-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[0.9375rem] whitespace-pre-wrap">
              {m.content}
            </div>
          </div>
        ) : (
          <AssistantTurn key={m.id} message={m} />
        ),
      )}
      {sending && messages[messages.length - 1]?.content === '' && <ThinkingRow />}
      <div ref={endRef} />
    </div>
  )
}

function AssistantTurn({ message }: { message: ChatMessage }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <div className="ax-rise group/turn flex gap-3">
      <div className="mt-0.5 shrink-0">
        <div className="border-border bg-card flex size-8 items-center justify-center rounded-full border">
          <AxiomaLogo className="size-4" id={`msg-${message.id}`} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {message.content ? (
          <Markdown content={message.content} />
        ) : (
          <span className="text-muted-foreground text-sm">…</span>
        )}
        {message.streaming && <span className="bg-foreground ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse align-middle" />}
        {message.error && <p className="text-destructive mt-2 text-sm">{message.error}</p>}
        {!message.streaming && message.content && (
          <button
            onClick={copy}
            className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover/turn:opacity-100"
            aria-label="Copiar resposta"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
    </div>
  )
}

function ThinkingRow(): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">
        <div className="border-border bg-card ax-breathe flex size-8 items-center justify-center rounded-full border">
          <AxiomaLogo className="size-4" id="thinking" />
        </div>
      </div>
      <div className="flex items-center gap-1 pt-2">
        <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
        <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
        <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full" />
      </div>
    </div>
  )
}
