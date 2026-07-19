'use client'

import { Download, ImageOff } from 'lucide-react'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'
import type { GalleryItem } from './types'

// Grid do histórico de gerações do próprio usuário (URLs assinadas resolvidas no
// client). Clicar abre no visor principal; botão de download por item.
export function Gallery({
  items,
  loading,
  onSelect,
  onDownload,
}: {
  items: GalleryItem[]
  loading: boolean
  onSelect: (item: GalleryItem) => void
  onDownload: (item: GalleryItem) => void
}): React.JSX.Element {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground border-border flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center text-sm">
        <ImageOff className="mb-2 size-5 opacity-60" />
        Nenhuma imagem gerada ainda.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="group border-border bg-muted/30 relative aspect-square overflow-hidden rounded-xl border"
        >
          {item.signedUrl ? (
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="block h-full w-full cursor-zoom-in"
              aria-label={`Abrir imagem: ${item.prompt.slice(0, 60)}`}
            >
              <Image
                src={item.signedUrl}
                alt={item.prompt}
                fill
                unoptimized
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
              indisponível
            </div>
          )}

          {/* Overlay: prompt + download */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="line-clamp-2 text-[11px] leading-tight text-white/90">{item.prompt}</span>
            {item.signedUrl ? (
              <button
                type="button"
                onClick={() => onDownload(item)}
                className="pointer-events-auto flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
                aria-label="Baixar imagem"
              >
                <Download className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
