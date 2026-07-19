import { RocketIcon } from 'lucide-react'

export function EmDesenvolvimento({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="ax-glow relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-transparent">
        <RocketIcon className="size-7 text-amber-500" />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Essa página ainda está em desenvolvimento.
      </p>
      <p className="text-muted-foreground/80 mt-4 max-w-lg text-sm leading-relaxed">
        Estamos construindo essa parte do Axyoma com o mesmo cuidado que colocamos no resto da
        plataforma — sem pressa pra entregar rápido e errado. Ela já está no roadmap e entra no ar
        em uma das próximas atualizações. Se você tem uma ideia específica do que gostaria de ver
        aqui, ou algo que faria essa página valer seu tempo, fale com a gente — o que constrói o
        Axyoma é justamente esse tipo de retorno de quem usa de verdade.
      </p>
    </div>
  )
}
