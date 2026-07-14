'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'

type OS = 'mac' | 'win' | 'linux' | 'other'

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other'
  const p = `${navigator.platform} ${navigator.userAgent}`.toLowerCase()
  if (p.includes('mac')) return 'mac'
  if (p.includes('win')) return 'win'
  if (p.includes('linux') || p.includes('x11')) return 'linux'
  return 'other'
}

const LABELS: Record<OS, string> = {
  mac: 'Baixar para macOS',
  win: 'Baixar para Windows',
  linux: 'Baixar para Linux',
  other: 'Baixar grátis',
}

function subscribe(): () => void {
  return () => {}
}

function useOS(): OS {
  return useSyncExternalStore(subscribe, detectOS, () => 'other' as OS)
}

export function FinalCta(): React.JSX.Element {
  const os = useOS()

  return (
    <section id="download" className="relative overflow-hidden border-t border-white/8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 30%, rgba(251,134,10,0.10), transparent 70%), radial-gradient(80% 40% at 50% 100%, rgba(246,64,14,0.06), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-2)]">
          Comece agora
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
          Baixe. Crie conta. Crie{' '}
          <span className="font-brand brand-text">sem</span> travar.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-base text-[var(--ink-dim)]">
          Grátis. 100 créditos. Sem cartão. Sem teto opaco.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/download"
            className="brand-gradient inline-flex rounded-full px-7 py-3.5 text-base font-semibold text-black shadow-lg shadow-orange-600/20 transition-transform hover:scale-[1.03]"
          >
            {LABELS[os]} →
          </Link>
          <Link
            href="/download"
            className="inline-flex rounded-full border border-white/15 px-7 py-3.5 text-base font-medium text-[var(--ink)] transition-colors hover:bg-white/5"
          >
            Outros sistemas
          </Link>
        </div>
      </div>
    </section>
  )
}
