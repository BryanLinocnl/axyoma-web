import Link from 'next/link'
import { AxiomaLogo } from '@/components/AxiomaLogo'

// Deterministic pseudo-random generator so StarField is render-pure in React 19.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function StarField(): React.JSX.Element {
  const rand = mulberry32(42)
  const stars = Array.from({ length: 110 }, (_, i) => {
    const left = Number.parseFloat((rand() * 100).toFixed(2))
    const top = Number.parseFloat((rand() * 100).toFixed(2))
    const size = Number.parseFloat((0.6 + rand() * 1.8).toFixed(2))
    const delay = Number.parseFloat((rand() * 5).toFixed(3))
    const dur = Number.parseFloat((2.5 + rand() * 3.5).toFixed(3))
    const amber = rand() > 0.72
    return { left, top, size, delay, dur, amber, i }
  })

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <span
          key={s.i}
          className="ax-star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.amber ? 'var(--brand-1)' : '#e8ecf4',
            ['--delay' as string]: `${s.delay}s`,
            ['--dur' as string]: `${s.dur}s`,
          }}
        />
      ))}
    </div>
  )
}

export function Hero(): React.JSX.Element {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <StarField />
      <div aria-hidden className="ax-hero-vignette pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center sm:px-6 sm:py-24">
        {/* Logo stage */}
        <div
          className="ax-hover ax-rise group relative mb-10 cursor-default"
          style={{ animationDelay: '40ms' }}
        >
          <div aria-hidden className="ax-halo" />
          <div className="ax-stage">
            <div aria-hidden className="brand-gradient absolute inset-0 rounded-[30px] opacity-30" />
            <div aria-hidden className="ax-beam" />
            <div aria-hidden className="ax-beam-rev" />
            <div
              className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[29px] sm:h-32 sm:w-32"
              style={{
                background: 'radial-gradient(80% 80% at 50% 42%, #131313, #070707)',
              }}
            >
              <AxiomaLogo
                id="hero"
                className="h-14 w-14 drop-shadow-[0_0_18px_rgba(251,134,10,.4)] transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_30px_rgba(252,179,27,.75)] sm:h-16 sm:w-16"
              />
            </div>
          </div>
        </div>

        {/* Eyebrow */}
        <p
          className="ax-rise text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-2)] sm:text-xs"
          style={{ animationDelay: '80ms' }}
        >
          Estúdio de engenharia · macOS · Windows · Linux
        </p>

        {/* H1 */}
        <h1
          className="ax-rise mt-5 text-[2.1rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl"
          style={{ animationDelay: '120ms' }}
        >
          Desenhe, planeje e{' '}
          <span className="font-brand brand-text">rode o agente</span>
          <span className="block sm:inline"> — sem limite de uso.</span>
        </h1>

        {/* Sub */}
        <p
          className="ax-rise mt-6 max-w-xl text-base leading-relaxed text-[var(--ink-dim)] sm:text-lg"
          style={{ animationDelay: '200ms' }}
        >
          O Axyoma é seu estúdio de engenharia com IA: crie artes, planeje features e escreva
          código num só app — com os melhores modelos e{' '}
          <strong className="font-medium text-white/90">sem teto artificial de uso</strong>.
          Créditos que <em className="font-brand not-italic text-white/90">você</em> controla. Sem
          chave de API. Sem montar stack.
        </p>

        {/* CTAs */}
        <div
          className="ax-rise mt-9 flex flex-col items-center gap-3 sm:flex-row"
          style={{ animationDelay: '280ms' }}
        >
          <Link
            href="/download"
            className="brand-gradient inline-flex items-center justify-center rounded-full px-7 py-3.5 text-base font-semibold text-black shadow-lg shadow-orange-600/25 transition-transform hover:scale-[1.03]"
          >
            Baixar grátis →
          </Link>
          <a
            href="#modos"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-3.5 text-base font-medium text-[var(--ink)] transition-colors hover:border-white/30 hover:bg-white/5"
          >
            Ver o app
          </a>
        </div>

        {/* Trust */}
        <p
          className="ax-rise mt-4 text-xs text-[var(--ink-faint)]"
          style={{ animationDelay: '340ms' }}
        >
          100 créditos grátis · use o quanto quiser com pacotes · sem cartão para começar
        </p>
      </div>
    </section>
  )
}
