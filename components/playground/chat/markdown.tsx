'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// PERFORMANCE: o `react-syntax-highlighter` (Prism completo) é pesado (~1MB) e só
// é necessário quando aparece um bloco de código. Carregamos sob demanda para não
// pesar no bundle inicial do Chat (melhora o LCP — o chat abre sem code blocks).
const CodeBlock = dynamic(() => import('./code-block').then((m) => m.CodeBlock), {
  ssr: false,
  loading: () => <div className="border-border bg-muted/40 my-3 h-24 animate-pulse rounded-xl border" />,
})

// Renderizador de markdown das respostas do assistente. GFM (tabelas, listas de
// tarefas, strikethrough) + code blocks com destaque. Estilizado com utilitários
// Tailwind (sem plugin de prose) para casar com o tema do app.
const COMPONENTS: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const text = String(children ?? '').replace(/\n$/, '')
    // Sem quebra de linha e sem linguagem => código inline.
    if (!match && !text.includes('\n')) {
      return (
        <code className="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
          {children}
        </code>
      )
    }
    return <CodeBlock language={match?.[1] ?? ''} value={text} />
  },
  p({ children }) {
    return <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-500 underline underline-offset-2 hover:text-amber-400">
        {children}
      </a>
    )
  },
  ul({ children }) {
    return <ul className="my-2 ml-5 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>
  },
  ol({ children }) {
    return <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>
  },
  h1({ children }) {
    return <h1 className="mt-4 mb-2 text-xl font-semibold first:mt-0">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="mt-3 mb-1.5 text-base font-semibold first:mt-0">{children}</h3>
  },
  blockquote({ children }) {
    return <blockquote className="border-border text-muted-foreground my-2 border-l-2 pl-3 italic">{children}</blockquote>
  },
  hr() {
    return <hr className="border-border my-4" />
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="border-border w-full border-collapse border text-sm">{children}</table>
      </div>
    )
  },
  th({ children }) {
    return <th className="border-border bg-muted/50 border px-3 py-1.5 text-left font-medium">{children}</th>
  },
  td({ children }) {
    return <td className="border-border border px-3 py-1.5">{children}</td>
  },
}

function MarkdownImpl({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="text-[0.9375rem]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

// Memoizado: durante o streaming o texto cresce token a token; evita re-parsear
// tudo quando a prop não muda (mensagens antigas).
export const Markdown = memo(MarkdownImpl)
