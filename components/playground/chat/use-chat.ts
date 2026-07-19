'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import type { ChatMessage, Conversation } from './types'

// Estado de erro estruturado do turno, para a UI decidir o que mostrar (o 402
// de saldo insuficiente recebe tratamento especial, com link p/ Faturamento).
export interface TurnError {
  kind: 'insufficient_credits' | 'auth' | 'network' | 'upstream'
  message: string
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini'

function localId(): string {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean || 'Nova conversa'
}

// Hook central do Chat: conversas, mensagens, streaming via proxy e persistência
// no Supabase (browser client, RLS own-rows). Todo LLM passa por
// `/api/v1/chat/completions` — nenhuma chave toca o client.
export function useChat(model: string) {
  const { userId, token, reload } = useConta()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<TurnError | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  // Espelho do id atual para as escritas/leituras assíncronas (evita colocar
  // `conversationId` nas deps dos callbacks). Sincronizado via efeito.
  const conversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  // --- Carrega a lista de conversas do usuário -------------------------------
  const loadConversations = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('chat_conversations')
      .select('id, title, model, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    setConversations((data as Conversation[]) ?? [])
    setLoadingConversations(false)
  }, [userId])

  useEffect(() => {
    // Carga inicial de dados do usuário (I/O assíncrono; setState pós-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de dados intencional
    void loadConversations()
  }, [loadConversations])

  // --- Seleciona uma conversa e carrega suas mensagens -----------------------
  const selectConversation = useCallback(
    async (id: string) => {
      if (id === conversationIdRef.current) return
      abortRef.current?.abort()
      setError(null)
      setConversationId(id)
      setLoadingMessages(true)
      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
      const rows = (data as Pick<ChatMessage, 'id' | 'role' | 'content'>[]) ?? []
      setMessages(rows.map((r) => ({ id: r.id, role: r.role, content: r.content })))
      setLoadingMessages(false)
    },
    [],
  )

  // --- Nova conversa (limpa a área) ------------------------------------------
  const newConversation = useCallback(() => {
    abortRef.current?.abort()
    setConversationId(null)
    setMessages([])
    setError(null)
  }, [])

  // --- Persistência ----------------------------------------------------------
  const persistMessage = useCallback(
    async (convId: string, role: ChatMessage['role'], content: string) => {
      if (!userId) return
      await supabase.from('chat_messages').insert({ conversation_id: convId, user_id: userId, role, content })
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
    },
    [userId],
  )

  // --- Envio + streaming -----------------------------------------------------
  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || sending || !userId) return
      setError(null)

      // 1) Garante a conversa (cria na primeira mensagem).
      let convId = conversationIdRef.current
      if (!convId) {
        const { data, error: insErr } = await supabase
          .from('chat_conversations')
          .insert({ user_id: userId, title: titleFrom(content), model })
          .select('id, title, model, created_at, updated_at')
          .single()
        if (insErr || !data) {
          setError({ kind: 'network', message: 'Não foi possível criar a conversa.' })
          return
        }
        convId = (data as Conversation).id
        setConversationId(convId)
        conversationIdRef.current = convId
        setConversations((prev) => [data as Conversation, ...prev])
      }

      // 2) Otimista: adiciona a mensagem do usuário e um placeholder do assistente.
      const userMsg: ChatMessage = { id: localId(), role: 'user', content }
      const assistantId = localId()
      const history = [...messages, userMsg]
      setMessages([...history, { id: assistantId, role: 'assistant', content: '', streaming: true }])
      setSending(true)

      void persistMessage(convId, 'user', content)

      // 3) Chama o proxy e consome o SSE.
      const controller = new AbortController()
      abortRef.current = controller
      let acc = ''
      try {
        const res = await fetch('/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            model,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => null)
          const type = (payload?.error?.type as string) || 'upstream'
          const msg = (payload?.error?.message as string) || 'Falha ao gerar resposta.'
          const kind: TurnError['kind'] =
            res.status === 402 || type === 'insufficient_credits'
              ? 'insufficient_credits'
              : res.status === 401 || type === 'auth'
                ? 'auth'
                : 'upstream'
          setError({ kind, message: msg })
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let done = false
        while (!done) {
          const { value, done: rdDone } = await reader.read()
          done = rdDone
          if (!value) continue
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') {
              done = true
              break
            }
            try {
              const obj = JSON.parse(data)
              const delta: string = obj?.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                acc += delta
                setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)))
              }
            } catch {
              /* keepalive / chunk parcial — ignora */
            }
          }
        }

        // 4) Finaliza a bolha e persiste a resposta.
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)))
        if (acc.trim()) void persistMessage(convId, 'assistant', acc)
        // Saldo mudou (o proxy debita ao fim do stream) — recarrega o contexto.
        void reload()
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          // Parada manual: mantém o que já chegou e persiste se houver conteúdo.
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)))
          if (acc.trim()) void persistMessage(convId, 'assistant', acc)
        } else {
          setError({ kind: 'network', message: 'Erro de conexão ao gerar a resposta.' })
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        }
      } finally {
        setSending(false)
        abortRef.current = null
      }
    },
    [sending, userId, model, messages, token, persistMessage, reload],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // --- Exclui uma conversa ---------------------------------------------------
  const deleteConversation = useCallback(
    async (id: string) => {
      await supabase.from('chat_conversations').delete().eq('id', id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (id === conversationIdRef.current) {
        setConversationId(null)
        setMessages([])
      }
    },
    [],
  )

  return {
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
    clearError: () => setError(null),
  }
}

export { DEFAULT_MODEL }
