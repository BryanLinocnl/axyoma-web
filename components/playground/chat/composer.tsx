'use client'

import { useRef, useState } from 'react'
import { ArrowUp, Plus, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModelSelector } from './model-selector'

// Composição estilo claude.ai: um único cartão arredondado que contém a textarea
// no topo e a barra de controles logo abaixo (dentro da mesma caixa). Enter envia
// (Shift+Enter quebra linha); o botão alterna entre enviar e parar no streaming.
export function Composer({
  model,
  onModelChange,
  onSend,
  onStop,
  sending,
  disabled,
}: {
  model: string
  onModelChange: (v: string) => void
  onSend: (text: string) => void
  onStop: () => void
  sending: boolean
  disabled?: boolean
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const hasText = value.trim().length > 0

  function autosize(): void {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  function submit(): void {
    const text = value.trim()
    if (!text || sending) return
    onSend(text)
    setValue('')
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto'
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-1 pb-4">
      <div className="border-border bg-card focus-within:ring-ring/40 rounded-[1.75rem] border p-2.5 shadow-sm transition-shadow focus-within:ring-2">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            autosize()
          }}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="Envie uma mensagem para o Axyoma…"
          className="text-foreground placeholder:text-muted-foreground max-h-[200px] w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-[0.9375rem] outline-none focus:outline-none focus-visible:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-2 pt-1.5">
          {/* Esquerda: ações auxiliares (anexar). Mic entraria aqui quando existir. */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
              aria-label="Adicionar anexo"
            >
              <Plus className="size-5" />
            </button>
          </div>

          {/* Direita: seletor de modelo + enviar/parar. */}
          <div className="flex items-center gap-1.5">
            <ModelSelector value={model} onChange={onModelChange} />
            {sending ? (
              <button
                onClick={onStop}
                className="text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-full transition-colors"
                aria-label="Parar geração"
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!hasText || disabled}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full bg-transparent transition-colors',
                  hasText
                    ? 'text-[var(--brand-2)] hover:bg-[var(--brand-2)]/10'
                    : 'text-muted-foreground/40 cursor-not-allowed',
                )}
                aria-label="Enviar mensagem"
              >
                <ArrowUp className="size-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-center text-[0.6875rem]">
        O Axyoma pode cometer erros. Cada resposta consome créditos.
      </p>
    </div>
  )
}
