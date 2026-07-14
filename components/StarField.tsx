// Campo de estrelas determinístico (mesmo motivo do app). Posições fixas por
// LCG — ~22% "quentes" (âmbar da marca), resto branco-gelo. Piscam em ritmos
// diferentes. Puramente decorativo.
const STARS = (() => {
  let seed = 7
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 120 }, () => ({
    x: rnd() * 100,
    y: rnd() * 100,
    s: rnd() * 1.6 + 0.6,
    delay: rnd() * 5,
    dur: rnd() * 3.5 + 2.5,
    warm: rnd() < 0.22,
  }))
})()

export function StarField({ className }: { className?: string }): React.JSX.Element {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}>
      {STARS.map((st, i) => (
        <span
          key={i}
          className="ax-star"
          style={
            {
              left: `${st.x}%`,
              top: `${st.y}%`,
              width: st.s,
              height: st.s,
              background: st.warm ? '#fcb31b' : '#e8ecf4',
              ['--delay' as string]: `${st.delay}s`,
              ['--dur' as string]: `${st.dur}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
