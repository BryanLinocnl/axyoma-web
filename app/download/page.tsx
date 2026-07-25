'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AxiomaMark } from '@/components/AxiomaMark'

// ============================================================
// COLOQUE AQUI OS LINKS DIRETOS PARA OS INSTALÁVEIS (não o repositório).
// Exemplo: .dmg, .exe, .AppImage, .deb, etc.
// ============================================================
const DOWNLOAD_LINKS = {
  mac:   'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/download/v0.3.1/AXYOMA.AI-0.3.1-arm64.dmg',
  win:   'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/download/v0.3.1/AXYOMA.AI-0.3.1-setup.exe',
  linux: 'https://github.com/BryanLinocnl/AXIOMA-AI-releases/releases/download/v0.3.1/AXYOMA.AI-0.3.1.AppImage',
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
    <div className="glass-site">
      <main className="gb-desk flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <Link href="/" className="mb-9 flex items-center gap-3">
          <span
            className="grid size-12 place-items-center rounded-full text-white"
            style={{ background: 'linear-gradient(to top, #1e40af, #2563eb)' }}
          >
            <AxiomaMark className="size-7" />
          </span>
          <span className="font-brand text-[30px] leading-none tracking-tight">Axyoma</span>
        </Link>

        <h1 className="gb-display max-w-[16ch] text-[clamp(2rem,5vw,3.25rem)]">
          Instale e comece em minutos.
        </h1>
        <p
          className="mt-5 max-w-[46ch] text-[16.5px] leading-relaxed"
          style={{ color: 'var(--ink-muted)' }}
        >
          Grátis. Crie sua conta e receba 400 créditos para começar — sem cartão, sem chave de API.
        </p>

        {/* O sistema detectado vira o botão primário (azul); os outros ficam
            como alternativa discreta. Antes os três tinham o mesmo peso e o
            visitante precisava escolher por conta própria. */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          {BUTTONS.map(({ key, label, icon: Icon }) => {
            const isDetected = os === key
            return (
              <a
                key={key}
                href={DOWNLOAD_LINKS[key as TargetOS]}
                target="_blank"
                rel="noreferrer"
                className={`gb-btn px-6 py-3 text-[15px] ${isDetected ? 'gb-btn-primary' : 'gb-btn-ghost'}`}
                aria-label={label}
              >
                <Icon className={`h-4 w-4 ${isDetected ? 'brightness-0 invert' : ''}`} />
                {isDetected ? 'Baixar para este dispositivo' : label}
              </a>
            )
          })}
        </div>

        <p className="mt-7 text-[13.5px]" style={{ color: 'var(--ink-faint)' }}>
          Não sabe qual é o seu sistema?{' '}
          <a
            href={RELEASES}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Veja todas as versões
          </a>
        </p>

        <p
          className="mt-12 border-t pt-8 text-[13.5px]"
          style={{ color: 'var(--ink-faint)', borderColor: 'var(--hairline)' }}
        >
          Já tem o app?{' '}
          <Link href="/conta/visao-geral/visao-geral" className="underline underline-offset-4">
            Acesse sua conta
          </Link>
        </p>
      </main>
    </div>
  )
}
