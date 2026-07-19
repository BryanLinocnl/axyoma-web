// Loader de geração de imagem: a logo AXYOMA em CINZA com uma faixa de brilho
// varrendo a lateral (igual à barra de carregamento do navegador do app).
// A silhueta da logo (mesmos paths do AxiomaLogo) é aplicada como máscara CSS,
// então a base cinza e a banda de brilho aparecem SÓ dentro do desenho da logo.
import { cn } from '@/lib/utils'

// Paths idênticos ao componente AxiomaLogo — a silhueta que serve de máscara.
const D1 =
  'M553.26,115.31h-81.53c-23.61,0-38.62,25.25-27.34,45.99l395.57,727.46c5.45,10.02,15.94,16.26,27.34,16.26h81.53c23.61,0,38.62-25.25,27.34-45.99L580.61,131.57c-5.45-10.02-15.94-16.26-27.34-16.26Z'
const D2 =
  'M470.74,115.31h81.53c23.61,0,38.62,25.25,27.34,45.99L184.05,888.77c-5.45,10.02-15.94,16.26-27.34,16.26h-81.53c-23.61,0-38.62-25.25-27.34-45.99L443.39,131.57c5.45-10.02,15.94-16.26,27.34-16.26Z'
const D3 =
  'M710.28,709.42c-110.06,0-199.27,89.21-199.27,199.27,0-110.06-89.21-199.27-199.25-199.27,110.04,0,199.25-89.19,199.25-199.25,0,110.06,89.21,199.25,199.27,199.25Z'

const MASK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 1024'><path d='${D1}'/><path d='${D2}'/><path d='${D3}'/></svg>`
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG)}")`

const maskStyle: React.CSSProperties = {
  WebkitMaskImage: MASK_URL,
  maskImage: MASK_URL,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
}

export function GenerationLoader({
  className,
  label = 'Gerando imagem…',
}: {
  className?: string
  label?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-5', className)} role="status" aria-live="polite">
      <div className="relative size-24 overflow-hidden sm:size-28" style={maskStyle}>
        {/* Base cinza da logo */}
        <div className="absolute inset-0 bg-neutral-400 opacity-45 dark:bg-neutral-400 dark:opacity-30" />
        {/* Brilho varrendo a lateral */}
        <div className="ax-shimmer-sweep" />
      </div>
      <p className="text-muted-foreground animate-pulse text-sm">{label}</p>
    </div>
  )
}
