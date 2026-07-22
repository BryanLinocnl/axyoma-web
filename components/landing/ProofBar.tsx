import {
  Wallet,
  Cpu,
  SquareTerminal,
  Infinity,
  Gift,
} from 'lucide-react'
import { GlowingEffect } from '@/components/ui/glowing-effect'

type Fact = {
  label: string
  value: string
  icon: React.ReactNode
}

const FACTS: Fact[] = [
  { label: '1 crédito', value: 'R$ 0,30', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Modelos', value: 'Claude, GPT, Gemini, DeepSeek…', icon: <Cpu className="h-4 w-4" /> },
  { label: 'Agente', value: 'Terminal, editor e GitHub', icon: <SquareTerminal className="h-4 w-4" /> },
  { label: 'Uso', value: 'Sem teto artificial', icon: <Infinity className="h-4 w-4" /> },
  { label: 'Free pack', value: '400 créditos', icon: <Gift className="h-4 w-4" /> },
]

export function ProofBar({ id }: { id?: string }): React.JSX.Element {
  return (
    <section
      id={id}
      aria-label="Provas factuais"
      className="relative overflow-hidden border-y border-white/10 bg-white/[0.015]"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--bg)] to-transparent" />

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {FACTS.map((fact) => (
          <FactCard key={fact.value} fact={fact} />
        ))}
      </div>
    </section>
  )
}

function FactCard({ fact }: { fact: Fact }) {
  return (
    <div className="group relative h-[9rem] min-h-[9rem] rounded-2xl border border-white/10 p-[5px]">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[13px] bg-[var(--bg)]/80 px-4 py-4 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-colors duration-300 group-hover:bg-[var(--bg)] sm:py-5">
        <div className="flex items-center justify-center rounded-full border border-brand/20 bg-brand/10 p-2 text-[var(--brand-2)] shadow-[0_0_14px_rgba(252,179,27,0.12)] transition-all duration-300 group-hover:scale-110 group-hover:border-brand/40 group-hover:shadow-[0_0_22px_rgba(252,179,27,0.22)]">
          {fact.icon}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-2)]">
            {fact.label}
          </span>
          <span className="max-w-[180px] text-sm font-medium leading-snug text-[var(--ink-dim)] sm:text-[15px]">
            {fact.value}
          </span>
        </div>
      </div>
    </div>
  )
}
