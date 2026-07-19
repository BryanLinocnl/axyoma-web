'use client'

import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Check, Copy } from 'lucide-react'
import { useTheme } from 'next-themes'

// Bloco de código com destaque de sintaxe + botão copiar. Tema segue o do app
// (next-themes). Usado pelo renderizador de markdown para os fenced code blocks.
export function CodeBlock({ language, value }: { language: string; value: string }): React.JSX.Element {
  const { resolvedTheme } = useTheme()
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível — silencioso */
    }
  }

  const isDark = resolvedTheme !== 'light'

  return (
    <div className="group/code border-border bg-muted/40 my-3 overflow-hidden rounded-xl border">
      <div className="border-border/60 text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-xs">
        <span className="font-mono lowercase">{language || 'text'}</span>
        <button
          onClick={copy}
          className="hover:text-foreground flex items-center gap-1 transition-colors"
          aria-label="Copiar código"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{ margin: 0, background: 'transparent', fontSize: '0.8125rem', padding: '0.875rem 1rem' }}
        codeTagProps={{ style: { fontFamily: 'var(--font-jetbrains), ui-monospace, monospace' } }}
        PreTag="div"
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}
