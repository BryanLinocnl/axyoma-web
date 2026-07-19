'use client'

import { Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IMAGE_MODELS } from './types'

// Caixa de prompt: descrição + modelo + botão Gerar. Ctrl/Cmd+Enter dispara.
export function PromptBox({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  onGenerate,
  disabled,
  generating,
}: {
  prompt: string
  onPromptChange: (v: string) => void
  model: string
  onModelChange: (v: string) => void
  onGenerate: () => void
  disabled: boolean
  generating: boolean
}): React.JSX.Element {
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !disabled) {
      e.preventDefault()
      onGenerate()
    }
  }

  return (
    <div className="border-border focus-within:border-ring/40 focus-within:ring-ring/15 bg-card rounded-2xl border p-4 shadow-sm transition-[border-color,box-shadow] focus-within:ring-[3px]">
      <Textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Descreva a imagem que você quer gerar… (ex.: um leão de origami dourado sobre fundo escuro, luz de estúdio)"
        rows={3}
        maxLength={2000}
        className="min-h-[88px] resize-none border-0 bg-transparent px-1 text-base shadow-none outline-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        disabled={generating}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Select value={model} onValueChange={(v) => v && onModelChange(v)} disabled={generating}>
          <SelectTrigger className="w-auto min-w-[200px] rounded-lg" aria-label="Modelo de imagem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {IMAGE_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="rounded-lg">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-xs sm:inline">⌘/Ctrl + Enter</span>
          <Button onClick={onGenerate} disabled={disabled} size="lg" className="brand-gradient text-white">
            <Sparkles className="size-4" />
            {generating ? 'Gerando…' : 'Gerar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
