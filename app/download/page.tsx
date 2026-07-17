'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { StarField } from '@/components/StarField'

// ============================================================
// COLOQUE AQUI OS LINKS DIRETOS PARA OS INSTALÁVEIS (não o repositório).
// Exemplo: .dmg, .exe, .AppImage, .deb, etc.
// ============================================================
const DOWNLOAD_LINKS = {
  mac:   'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/download/v0.2.1/AXYOMA-AI-0.2.1-arm64.dmg',
  win:   'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/download/v0.2.1/AXYOMA-AI-0.2.1-setup.exe',
  linux: 'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/download/v0.2.1/AXYOMA-AI-0.2.1.AppImage',
} as const

const RELEASES = 'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/latest'

type OS = 'mac' | 'win' | 'linux' | 'other'

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other'
  const p = `${navigator.platform} ${navigator.userAgent}`.toLowerCase()
  if (p.includes('mac')) return 'mac'
  if (p.includes('win')) return 'win'
  if (p.includes('linux') || p.includes('x11')) return 'linux'
  return 'other'
}

function subscribe(): () => void {
  return () => {}
}

function useOS(): OS {
  return useSyncExternalStore(subscribe, detectOS, () => 'other' as OS)
}

function MacIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/apple-logo-svgrepo-com.svg"
      alt=""
      width={20}
      height={20}
      unoptimized
      className={className}
      aria-hidden="true"
    />
  )
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 3.45L9.89 1.98L9.89 11.26L0 11.26L0 3.45ZM10.74 11.26L24 11.26L24 0L10.74 1.63L10.74 11.26ZM0 12.74L9.89 12.74L9.89 22.02L0 20.55L0 12.74ZM10.74 12.74L10.74 22.37L24 24L24 12.74L10.74 12.74Z" />
    </svg>
  )
}

function LinuxIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/linux-svgrepo-com.svg"
      alt=""
      width={20}
      height={20}
      unoptimized
      className={className}
      aria-hidden="true"
    />
  )
}

type TargetOS = keyof typeof DOWNLOAD_LINKS

const BUTTONS: { key: TargetOS; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'mac', label: 'Baixar para macOS', icon: MacIcon },
  { key: 'win', label: 'Baixar para Windows', icon: WindowsIcon },
  { key: 'linux', label: 'Baixar para Linux', icon: LinuxIcon },
]

export default function DownloadPage(): React.JSX.Element {
  const os = useOS()

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <StarField />
      <div className="relative z-10 flex flex-col items-center">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <AxiomaLogo id="dl" className="h-8 w-8" />
          <span className="font-brand text-xl italic">Axyoma</span>
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Baixe o <span className="font-brand italic brand-text">Axyoma IA</span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-[var(--ink-dim)]">
          Grátis. Crie sua conta e ganhe 100 créditos para começar.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {BUTTONS.map(({ key, label, icon: Icon }) => {
            const isDetected = os === key
            return (
              <a
                key={key}
                href={DOWNLOAD_LINKS[key as TargetOS]}
                target="_blank"
                rel="noreferrer"
                className={`brand-gradient inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-orange-600/25 transition-transform hover:scale-[1.03] ${isDetected ? 'ring-2 ring-white/40' : ''}`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
                {isDetected ? 'Baixar para este dispositivo' : label}
              </a>
            )
          })}
        </div>

        <p className="mt-6 text-xs text-[var(--ink-faint)]">
          Não sabe qual é o seu sistema?{' '}
          <a href={RELEASES} target="_blank" rel="noreferrer" className="underline">Veja todas as versões</a>
        </p>

        <p className="mt-8 text-xs text-[var(--ink-faint)]">
          Já tem o app? <Link href="/conta" className="underline">Acesse sua conta</Link>
        </p>
      </div>
    </main>
  )
}
