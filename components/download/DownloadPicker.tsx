'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import type { Installer } from '@/lib/releases'
import { formatSize } from '@/lib/releases'

function MacIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Image src="/apple-logo-svgrepo-com.svg" alt="" width={18} height={18} unoptimized className={className} aria-hidden />
  )
}
function WindowsIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M0 3.45L9.89 1.98L9.89 11.26L0 11.26L0 3.45ZM10.74 11.26L24 11.26L24 0L10.74 1.63L10.74 11.26ZM0 12.74L9.89 12.74L9.89 22.02L0 20.55L0 12.74ZM10.74 12.74L10.74 22.37L24 24L24 12.74L10.74 12.74Z" />
    </svg>
  )
}
function LinuxIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Image src="/linux-svgrepo-com.svg" alt="" width={18} height={18} unoptimized className={className} aria-hidden />
  )
}

const ICONS: Record<Installer['os'], (p: { className?: string }) => React.JSX.Element> = {
  mac: MacIcon,
  win: WindowsIcon,
  linux: LinuxIcon,
}

/** Nome do sistema para a frase de "ainda não temos isso". */
const SISTEMA: Record<Installer['id'], string> = {
  'mac-arm64': 'Mac com Apple Silicon',
  'mac-x64': 'Mac com Intel',
  win: 'Windows',
  linux: 'Linux',
}

/**
 * Adivinha, SEM esperar nada assíncrono, qual instalador serve esta máquina.
 *
 * O ponto difícil é Apple Silicon x Intel: o user agent do macOS mente sobre a
 * arquitetura (todo Mac se anuncia como Intel por compatibilidade). O truque
 * confiável é o renderer do WebGL — em Apple Silicon ele responde "Apple GPU"
 * ou "Apple M…", em Intel responde "Intel"/"AMD Radeon".
 *
 * Sem WebGL, assumimos Apple Silicon: é o que a Apple vende desde o fim de
 * 2020. E o erro é barato — a lista completa fica logo abaixo do botão.
 */
function guess(): Installer['id'] | null {
  if (typeof navigator === 'undefined') return null
  const ua = `${navigator.platform ?? ''} ${navigator.userAgent}`.toLowerCase()
  if (ua.includes('win')) return 'win'
  if (ua.includes('linux') || ua.includes('x11')) return 'linux'
  if (!ua.includes('mac')) return null

  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : ''
    if (/intel|amd|radeon/i.test(renderer)) return 'mac-x64'
  } catch {
    /* sem WebGL — cai no padrão */
  }
  return 'mac-arm64'
}

export function DownloadPicker({
  installers,
  version,
}: {
  installers: Installer[]
  version: string
}): React.JSX.Element {
  // `null` no primeiro paint (o servidor não sabe a máquina). Só depois de
  // montar é que decidimos, senão a hidratação diverge.
  const [detected, setDetected] = useState<Installer['id'] | null>(null)

  useEffect(() => {
    setDetected(guess())

    // Refino: no Chromium dá para perguntar a arquitetura de verdade, o que
    // dispensa o palpite do WebGL. É assíncrono, então entra depois.
    const uaData = (
      navigator as Navigator & {
        userAgentData?: {
          getHighEntropyValues?: (h: string[]) => Promise<{ platform?: string; architecture?: string }>
        }
      }
    ).userAgentData
    void uaData?.getHighEntropyValues?.(['architecture', 'platform'])
      .then((v) => {
        if (v.platform !== 'macOS' || !v.architecture) return
        setDetected(v.architecture === 'arm' ? 'mac-arm64' : 'mac-x64')
      })
      .catch(() => {})
  }, [])

  const primary = installers.find((i) => i.id === detected) ?? null
  const others = primary ? installers.filter((i) => i.id !== primary.id) : installers

  return (
    <div className="mt-10 flex w-full max-w-[560px] flex-col items-center">
      {primary ? (
        (() => {
          const Icon = ICONS[primary.os]
          return (
            <a
              href={primary.url}
              className="gb-btn gb-btn-primary w-full px-6 py-4 text-[16px] sm:w-auto sm:min-w-[340px]"
            >
              <Icon className="h-[18px] w-[18px] brightness-0 invert" />
              Baixar para {primary.label}
              <span className="font-normal opacity-75">· {primary.detail}</span>
            </a>
          )
        })()
      ) : detected ? (
        // Detectamos o sistema e não temos binário para ele — hoje, Linux.
        // Dizer isso é melhor do que mandar "escolha abaixo" e deixar a pessoa
        // procurar numa lista onde o sistema dela não está.
        <p className="max-w-[42ch] text-center text-[15px]" style={{ color: 'var(--ink-muted)' }}>
          Ainda não há instalador para {SISTEMA[detected] ?? 'o seu sistema'}. Os disponíveis estão
          logo abaixo.
        </p>
      ) : (
        <p className="text-[15px]" style={{ color: 'var(--ink-muted)' }}>
          Escolha o instalador do seu sistema abaixo.
        </p>
      )}

      {primary && (
        // A versão exibida é a DO BINÁRIO, não a da página: quando uma
        // plataforma fica para trás (release publicado sem ela), dizer o número
        // do release mais novo aqui seria falso justamente para quem vai baixar
        // o arquivo antigo.
        <p className="mt-3 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          Versão {primary.version}
          {formatSize(primary.size) ? ` · ${formatSize(primary.size)}` : ''} · detectamos o seu
          sistema automaticamente
        </p>
      )}

      {/* Lista completa: um Mac Intel que caiu no palpite errado, ou quem baixa
          num computador para instalar em outro, resolve aqui. */}
      <div className="mt-10 w-full">
        <p
          className="mb-3 text-left text-[13px] font-medium"
          style={{ color: 'var(--ink-faint)' }}
        >
          {primary ? 'Outras versões' : 'Todos os instaladores'}
        </p>
        <ul
          className="gb-raised overflow-hidden rounded-[14px] text-left"
          style={{ border: '1px solid var(--hairline)' }}
        >
          {others.map((inst, i) => {
            const Icon = ICONS[inst.os]
            return (
              <li key={inst.id} style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}>
                <a
                  href={inst.url}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-70" />
                  <span className="text-[14.5px] font-medium">{inst.label}</span>
                  <span className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
                    {inst.detail}
                  </span>
                  {/* Só aparece quando esta plataforma ficou para trás. No caso
                      normal (todas na mesma versão) a linha continua limpa. */}
                  {inst.version !== version && (
                    <span
                      className="gb-mono rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        border: '1px solid var(--hairline-strong, var(--hairline))',
                        color: 'var(--ink-faint)',
                      }}
                      title={`A versão ${version} ainda não tem instalador para ${inst.label}.`}
                    >
                      v{inst.version}
                    </span>
                  )}
                  <span
                    className="gb-mono ml-auto text-[12.5px]"
                    style={{ color: 'var(--ink-faint)' }}
                  >
                    {formatSize(inst.size)}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>

      <p
        className="mt-4 flex items-center gap-1.5 text-[12.5px]"
        style={{ color: 'var(--ink-faint)' }}
      >
        <Check className="size-3.5" aria-hidden />
        Cada link aponta para a versão mais recente disponível para aquele sistema.
      </p>
    </div>
  )
}
