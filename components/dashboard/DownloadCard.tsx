'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Download } from 'lucide-react'
import { Card } from '@/components/ui/card'

// OS-detect reaproveitado de `app/download/page.tsx` — só o rótulo/ícone muda
// aqui; o CTA sempre leva para `/download`, que tem os links diretos por SO.
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

const OS_LABEL: Record<OS, string> = {
  mac: 'macOS',
  win: 'Windows',
  linux: 'Linux',
  other: 'seu sistema',
}

function OSIcon({ os, className }: { os: OS; className?: string }): React.JSX.Element {
  // Os SVGs (apple/linux) são pretos monocromáticos → sem contraste no dark mode.
  // `dark:invert` os torna brancos no tema escuro.
  const imgClass = `${className ?? ''} dark:invert`.trim()
  if (os === 'mac') {
    return <Image src="/apple-logo-svgrepo-com.svg" alt="" width={16} height={16} unoptimized className={imgClass} aria-hidden="true" />
  }
  if (os === 'linux') {
    return <Image src="/linux-svgrepo-com.svg" alt="" width={16} height={16} unoptimized className={imgClass} aria-hidden="true" />
  }
  return <Download className={className} aria-hidden="true" />
}

export function DownloadCard(): React.JSX.Element {
  const os = useOS()

  return (
    <Card className="flex flex-col justify-center gap-6 p-6">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
          <OSIcon os={os} className="size-4" />
        </span>
        <div>
          <p className="text-lg font-semibold">Baixar Axyoma IA Code</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Instale o app para {OS_LABEL[os]} e use seus créditos direto do editor.
          </p>
        </div>
      </div>
      <Link
        href="/download"
        className="brand-gradient rounded-full py-2.5 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02] dark:text-black"
      >
        Baixar agora
      </Link>
    </Card>
  )
}
