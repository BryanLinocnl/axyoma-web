'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { ConversationSidebar } from './conversation-sidebar'
import { MessageList } from './message-list'
import { Composer } from './composer'
import { useChat, DEFAULT_MODEL } from './use-chat'

// Orquestra a página P5: sidebar de conversas + thread + composer. Estado e
// streaming ficam no hook `useChat`; todo LLM passa pelo proxy server-only.
// Layout centrado numa coluna de 720px (marca + headline Playfair/âmbar no vazio,
// composer estilo claude.ai fixado no rodapé quando há mensagens).
export function ChatShell(): React.JSX.Element {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const {
    conversations,
    conversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    send,
    stop,
    selectConversation,
    newConversation,
    deleteConversation,
    clearError,
  } = useChat(model)

  const empty = messages.length === 0 && !loadingMessages

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="hidden h-full md:block">
        <ConversationSidebar
          conversations={conversations}
          activeId={conversationId}
          loading={loadingConversations}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={deleteConversation}
        />
      </div>

      <div className="bg-background flex min-w-0 flex-1 flex-col">
        {loadingMessages ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Carregando conversa…</div>
        ) : empty ? (
          // Vazio: marca + headline Playfair/âmbar + composer, centralizados na coluna de 860px.
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
            <div className="w-full max-w-[860px]">
              <div className="ax-rise mb-8 flex flex-col items-center text-center">
                {/* Logo stage — IDÊNTICO ao Hero da landing (mesmo icone + efeitos). */}
                <div className="ax-hover group relative mb-6 cursor-default">
                  <div aria-hidden className="ax-halo" />
                  <div className="ax-stage">
                    <div aria-hidden className="brand-gradient absolute inset-0 rounded-[30px] opacity-30" />
                    <div aria-hidden className="ax-beam" />
                    <div aria-hidden className="ax-beam-rev" />
                    <div
                      className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[29px] sm:h-32 sm:w-32"
                      style={{ background: 'radial-gradient(80% 80% at 50% 42%, #131313, #070707)' }}
                    >
                      <AxiomaLogo
                        id="welcome"
                        className="h-14 w-14 drop-shadow-[0_0_18px_rgba(251,134,10,.4)] transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_30px_rgba(252,179,27,.75)] sm:h-16 sm:w-16"
                      />
                    </div>
                  </div>
                </div>
                <h1 className="font-brand text-3xl font-normal italic tracking-tight text-amber-800 sm:text-4xl">
                  Como posso te ajudar hoje?
                </h1>
              </div>
              {error && <ErrorBanner kind={error.kind} message={error.message} onDismiss={clearError} />}
              <Composer
                model={model}
                onModelChange={setModel}
                onSend={send}
                onStop={stop}
                sending={sending}
              />
            </div>
          </div>
        ) : (
          // Com mensagens: thread rolável + composer fixado no rodapé, ambos na coluna de 720px.
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MessageList messages={messages} sending={sending} />
            </div>
            {error && <ErrorBanner kind={error.kind} message={error.message} onDismiss={clearError} />}
            <Composer
              model={model}
              onModelChange={setModel}
              onSend={send}
              onStop={stop}
              sending={sending}
            />
          </>
        )}
      </div>
    </div>
  )
}

function ErrorBanner({
  kind,
  message,
  onDismiss,
}: {
  kind: string
  message: string
  onDismiss: () => void
}): React.JSX.Element {
  const isCredits = kind === 'insufficient_credits'
  return (
    <div className="mx-auto w-full max-w-[860px] px-1 pb-2">
      <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
        <AlertCircle className="size-4 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">{isCredits ? 'Saldo insuficiente' : 'Não foi possível responder'}</p>
          <p className="opacity-90">
            {isCredits ? 'Você ficou sem créditos. Recarregue para continuar conversando.' : message}
          </p>
        </div>
        {isCredits ? (
          <Link
            href="/conta/faturamento/creditos"
            className="brand-gradient shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white dark:text-black"
          >
            Comprar créditos
          </Link>
        ) : (
          <button onClick={onDismiss} className="shrink-0 text-xs font-medium underline underline-offset-2">
            Dispensar
          </button>
        )}
      </div>
    </div>
  )
}
