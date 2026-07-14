'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { AxiomaLogo } from '@/components/AxiomaLogo'

type Mode = 'design' | 'plan' | 'code'

const TABS: { id: Mode; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'plan', label: 'Plan' },
  { id: 'code', label: 'Code' },
]

export function ProductMock({ className = '' }: { className?: string }): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('design')
  const baseId = useId()
  const tabRefs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({})

  const selectMode = useCallback((nextMode: Mode) => {
    setMode(nextMode)
    tabRefs.current[nextMode]?.focus()
  }, [])

  const onKeyTabs = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = TABS.findIndex((t) => t.id === mode)
      let nextMode: Mode | undefined
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextMode = TABS[(idx + 1) % TABS.length].id
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextMode = TABS[(idx - 1 + TABS.length) % TABS.length].id
      } else if (e.key === 'Home') {
        nextMode = TABS[0].id
      } else if (e.key === 'End') {
        nextMode = TABS[TABS.length - 1].id
      }
      if (nextMode) {
        e.preventDefault()
        selectMode(nextMode)
      }
    },
    [mode, selectMode],
  )

  return (
    <div
      role="region"
      aria-label="Prévia interativa do app Axyoma"
      className={`ax-mock overflow-hidden rounded-2xl ${className}`}
    >
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-white/8 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AxiomaLogo
            id={`${baseId}-logo`}
            className="h-3.5 w-3.5 shrink-0 drop-shadow-[0_0_6px_rgba(251,134,10,.55)]"
          />
          <span className="truncate text-[11px] text-[var(--ink-faint)]">Axyoma — estúdio</span>
        </div>
      </div>

      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Modos do app"
        className="flex items-center gap-1 border-b border-white/8 px-2.5 py-1.5"
        onKeyDown={onKeyTabs}
      >
        {TABS.map((tab) => {
          const selected = mode === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                tabRefs.current[tab.id] = node
              }}
              onClick={() => selectMode(tab.id)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? 'bg-[rgba(251,134,10,0.18)] text-[var(--brand-1)]'
                  : 'text-[var(--ink-dim)] hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={selected ? 'font-brand not-italic' : ''}>{tab.label}</span>
              {tab.id === 'design' && (
                <span className="ml-1.5 rounded-full bg-white/8 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                  Pro · em breve
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Panels */}
      <div className="relative min-h-[320px] sm:min-h-[360px]">
        <div
          role="tabpanel"
          id={`${baseId}-panel-design`}
          aria-labelledby={`${baseId}-tab-design`}
          hidden={mode !== 'design'}
          className="h-full"
        >
          {mode === 'design' && <DesignPanel />}
        </div>
        <div
          role="tabpanel"
          id={`${baseId}-panel-plan`}
          aria-labelledby={`${baseId}-tab-plan`}
          hidden={mode !== 'plan'}
          className="h-full"
        >
          {mode === 'plan' && <PlanPanel />}
        </div>
        <div
          role="tabpanel"
          id={`${baseId}-panel-code`}
          aria-labelledby={`${baseId}-tab-code`}
          hidden={mode !== 'code'}
          className="h-full"
        >
          {mode === 'code' && <CodePanel />}
        </div>
      </div>
    </div>
  )
}

function DesignPanel(): React.JSX.Element {
  return (
    <div className="grid h-full grid-cols-[88px_1fr] sm:grid-cols-[104px_1fr]">
      {/* Sidebar formats */}
      <aside className="flex flex-col gap-1.5 border-r border-white/8 p-2.5">
        <p className="mb-1 px-1 text-[9px] font-medium uppercase tracking-wider text-[var(--ink-faint)]">
          Formato
        </p>
        {[
          { label: 'Post 1:1', active: true },
          { label: 'Carrossel', active: false },
          { label: 'Story', active: false },
          { label: 'Motion', active: false },
        ].map((f) => (
          <div
            key={f.label}
            className={`rounded-md px-2 py-1.5 text-[10px] ${
              f.active
                ? 'bg-[rgba(251,134,10,0.15)] text-[var(--brand-1)]'
                : 'text-[var(--ink-dim)]'
            }`}
          >
            {f.label}
          </div>
        ))}
        <div className="mt-auto rounded-md border border-dashed border-white/10 px-2 py-3 text-center text-[9px] text-[var(--ink-faint)]">
          + template
        </div>
      </aside>

      {/* Canvas / previews */}
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-brand text-sm tracking-tight text-white">Modo Design</p>
            <p className="text-[11px] text-[var(--ink-faint)]">A IA desenha. Você publica.</p>
          </div>
          <span className="brand-gradient rounded-full px-2.5 py-1 text-[10px] font-semibold text-black">
            Exportar
          </span>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:gap-3">
          {/* Main post preview */}
          <div className="col-span-2 flex aspect-[16/10] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0c] sm:col-span-1 sm:aspect-square">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-0 opacity-80"
                style={{
                  background:
                    'radial-gradient(60% 50% at 50% 40%, rgba(251,134,10,0.35), transparent 70%), linear-gradient(160deg, #121214 0%, #070708 100%)',
                }}
              />
              <div className="relative z-10 px-4 text-center">
                <p className="font-brand text-lg text-white sm:text-xl">Crie sem travar</p>
                <p className="mt-1 text-[10px] text-[var(--ink-dim)]">campanha · feed</p>
              </div>
              <div
                aria-hidden
                className="absolute bottom-3 right-3 h-8 w-8 rounded-full opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #fcb31b, #e32111)',
                  boxShadow: '0 0 18px rgba(251,134,10,.45)',
                }}
              />
            </div>
          </div>

          {/* Carousel strip */}
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {['01', '02', '03'].map((n, i) => (
                <div
                  key={n}
                  className="relative flex aspect-[3/4] items-end overflow-hidden rounded-lg border border-white/10 bg-[#0d0d10] p-1.5"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        i === 0
                          ? 'linear-gradient(180deg, rgba(252,179,27,.25), #0d0d10 70%)'
                          : i === 1
                            ? 'linear-gradient(180deg, rgba(246,64,14,.2), #0d0d10 70%)'
                            : 'linear-gradient(180deg, rgba(255,255,255,.06), #0d0d10 70%)',
                    }}
                  />
                  <span className="relative text-[9px] font-medium text-white/70">{n}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
              <p className="text-[10px] text-[var(--ink-dim)]">
                Posts, carrosséis, motions — a IA monta, você ajusta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanPanel(): React.JSX.Element {
  const tasks = [
    { title: 'Mapear fluxos do checkout', status: 'aprovado' as const },
    { title: 'Modelar tabela de créditos', status: 'aprovado' as const },
    { title: 'Criar endpoint de pagamento', status: 'pendente' as const },
    { title: 'Testes de regressão no proxy', status: 'pendente' as const },
  ]

  return (
    <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-brand text-sm tracking-tight text-white">Modo Plan</p>
          <p className="text-[11px] text-[var(--ink-faint)]">Nada roda sem a sua aprovação.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-[var(--ink-dim)]">
          2 / 4 aprovadas
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li
            key={t.title}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                t.status === 'aprovado'
                  ? 'bg-[rgba(251,134,10,0.2)] text-[var(--brand-1)]'
                  : 'border border-white/15 text-[var(--ink-faint)]'
              }`}
              aria-hidden
            >
              {t.status === 'aprovado' ? '✓' : '·'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white">{t.title}</p>
              <p className="text-[10px] capitalize text-[var(--ink-faint)]">{t.status}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-2 rounded-xl border border-[rgba(251,134,10,0.25)] bg-[rgba(251,134,10,0.06)] px-3 py-2.5">
        <p className="text-[11px] text-[var(--ink-dim)]">
          Revise o plano. Só então o agente executa.
        </p>
        <span className="brand-gradient shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-black">
          Aprovar plano
        </span>
      </div>
    </div>
  )
}

type Token = { t: string; c?: string }

const CODE_SNIPPET: Token[][] = [
  [
    { t: 'export function', c: 'text-[#c792ea]' },
    { t: ' ' },
    { t: 'spend', c: 'text-[#82aaff]' },
    { t: '(n: ', c: 'text-white' },
    { t: 'number', c: 'text-[#c792ea]' },
    { t: ') {', c: 'text-white' },
  ],
  [
    { t: '  if (n \u2264 0) ', c: 'text-white' },
    { t: 'return', c: 'text-[#c792ea]' },
    { t: ';', c: 'text-white' },
  ],
  [{ t: '  balance -= n;', c: 'text-white' }],
  [
    { t: '  ', c: 'text-white' },
    { t: 'return', c: 'text-[#c792ea]' },
    { t: ' balance;', c: 'text-white' },
  ],
  [{ t: '}', c: 'text-white' }],
]

function CodePanel(): React.JSX.Element {
  const calls = [
    { tool: 'read_file', arg: 'app/api/checkout/route.ts' },
    { tool: 'edit_file', arg: 'lib/credits.ts' },
    { tool: 'run_command', arg: 'npm run test -- credits' },
  ]

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-0">
      <div className="flex items-center justify-between border-b border-white/8 px-3.5 py-2.5">
        <div>
          <p className="font-brand text-sm tracking-tight text-white">Modo Code</p>
          <p className="text-[11px] text-[var(--ink-faint)]">Do arquivo ao PR — o agente faz.</p>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 sm:grid-cols-[1fr_1.1fr]">
        {/* Tool calls */}
        <div className="flex flex-col gap-1.5 border-b border-white/8 p-3 sm:border-b-0 sm:border-r">
          <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-[var(--ink-faint)]">
            Tool calls
          </p>
          {calls.map((c, i) => (
            <div
              key={c.tool + c.arg}
              className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2 font-mono"
            >
              <p className="text-[10px] text-[var(--brand-1)]">
                <span className="text-[var(--ink-faint)]">{String(i + 1).padStart(2, '0')}</span>{' '}
                {c.tool}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--ink-dim)]">{c.arg}</p>
            </div>
          ))}
        </div>

        {/* Editor + terminal */}
        <div className="flex min-h-0 flex-col">
          <div className="flex-1 p-3 font-mono">
            <p className="mb-2 text-[9px] text-[var(--ink-faint)]">lib/credits.ts</p>
            <pre className="overflow-hidden text-[10px] leading-relaxed text-[var(--ink-dim)]">
              <code>
                {CODE_SNIPPET.map((line, li) => (
                  <span key={li}>
                    {line.map((tok, ti) => (
                      <span key={ti} className={tok.c}>
                        {tok.t}
                      </span>
                    ))}
                    {'\n'}
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <div className="border-t border-white/8 bg-black/40 px-3 py-2 font-mono">
            <p className="text-[10px] text-[var(--ink-faint)]">
              <span className="text-[var(--brand-2)]">›</span> npm run test -- credits
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-400/80">✓ 12 passed · git push origin feat/credits</p>
          </div>
        </div>
      </div>
    </div>
  )
}
