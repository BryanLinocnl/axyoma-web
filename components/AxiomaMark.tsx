/**
 * A marca do Axyoma em UMA cor só (herda `currentColor`).
 *
 * Existe separada de `AxiomaLogo` porque aquela traz o degradê âmbar→vermelho
 * fixo, que some sobre o círculo azul do login do app. Mesmos caminhos, sem
 * gradiente — é a versão `axioma-mark-dark.svg` que o app usa no tema claro.
 */
export function AxiomaMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M553.26,115.31h-81.53c-23.61,0-38.62,25.25-27.34,45.99l395.57,727.46c5.45,10.02,15.94,16.26,27.34,16.26h81.53c23.61,0,38.62-25.25,27.34-45.99L580.61,131.57c-5.45-10.02-15.94-16.26-27.34-16.26Z"
      />
      <path
        fill="currentColor"
        d="M470.74,115.31h81.53c23.61,0,38.62,25.25,27.34,45.99L184.05,888.77c-5.45,10.02-15.94,16.26-27.34,16.26h-81.53c-23.61,0-38.62-25.25-27.34-45.99L443.39,131.57c5.45-10.02,15.94-16.26,27.34-16.26Z"
      />
      <path
        fill="currentColor"
        d="M710.28,709.42c-110.06,0-199.27,89.21-199.27,199.27,0-110.06-89.21-199.27-199.25-199.27,110.04,0,199.25-89.19,199.25-199.25,0,110.06,89.21,199.25,199.27,199.25Z"
      />
    </svg>
  )
}
