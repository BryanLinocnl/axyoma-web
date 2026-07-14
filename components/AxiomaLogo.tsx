// Marca AXYOMA (o "A" com o brilho central), gradiente âmbar→vermelho fixo.
// Portada do app. Dimensione via className (ex.: "w-20 h-20").
const STOPS = [
  { o: '0', c: '#fcb31b' },
  { o: '.04', c: '#fba716' },
  { o: '.11', c: '#fb950f' },
  { o: '.19', c: '#fb890b' },
  { o: '.28', c: '#fb860a' },
  { o: '.67', c: '#f6400e' },
  { o: '1', c: '#e32111' },
]

export function AxiomaLogo({ className, id = 'ax' }: { className?: string; id?: string }): React.JSX.Element {
  const g1 = `${id}-g1`
  const g2 = `${id}-g2`
  const g3 = `${id}-g3`
  const stops = STOPS.map((s) => <stop key={s.o} offset={s.o} stopColor={s.c} />)
  return (
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={g1} x1="440.56" y1="510.17" x2="980" y2="510.17" gradientUnits="userSpaceOnUse">
          {stops}
        </linearGradient>
        <linearGradient id={g2} x1="535.12" y1="115.63" x2="96.33" y2="897.57" gradientUnits="userSpaceOnUse">
          {stops}
        </linearGradient>
        <linearGradient id={g3} x1="511.02" y1="512.13" x2="511.02" y2="923.62" gradientUnits="userSpaceOnUse">
          {stops}
        </linearGradient>
      </defs>
      <path
        fill={`url(#${g1})`}
        d="M553.26,115.31h-81.53c-23.61,0-38.62,25.25-27.34,45.99l395.57,727.46c5.45,10.02,15.94,16.26,27.34,16.26h81.53c23.61,0,38.62-25.25,27.34-45.99L580.61,131.57c-5.45-10.02-15.94-16.26-27.34-16.26Z"
      />
      <path
        fill={`url(#${g2})`}
        d="M470.74,115.31h81.53c23.61,0,38.62,25.25,27.34,45.99L184.05,888.77c-5.45,10.02-15.94,16.26-27.34,16.26h-81.53c-23.61,0-38.62-25.25-27.34-45.99L443.39,131.57c5.45-10.02,15.94-16.26,27.34-16.26Z"
      />
      <path
        fill={`url(#${g3})`}
        d="M710.28,709.42c-110.06,0-199.27,89.21-199.27,199.27,0-110.06-89.21-199.27-199.25-199.27,110.04,0,199.25-89.19,199.25-199.25,0,110.06,89.21,199.25,199.27,199.25Z"
      />
    </svg>
  )
}
