'use client'

import { CheckIcon, LayersIcon } from 'lucide-react'
import { useConta } from '@/lib/conta-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Planos (copy definido pelo produto). Pro e Teams estão "Em breve" — sem preço
// exibido (a precificação ainda será finalizada). Em todos os planos o usuário
// pode comprar créditos avulsos quando os créditos do plano acabarem.
type PlanCard = {
  title: string
  price?: string // só o Free mostra "Grátis"; Pro/Teams ficam "Em breve"
  comingSoon?: boolean
  items: string[]
}

const PLANS: PlanCard[] = [
  {
    title: 'Free',
    price: 'Grátis',
    items: [
      // Dizia "100 créditos" — o bônus é 400 e vale só nos modelos da Vertex AI.
      // Anunciar número errado na tela de faturamento é o pior lugar possível
      // para errar: é onde o usuário confere se a conta bate.
      '100 créditos de bônus (modelos Vertex AI, não renováveis)',
      'Code Mode e Plan Mode',
      'Navegador Inteligente',
      'Editor de Código Integrado',
      'MCPs',
      'Busca na Web',
      'Criador de Skills',
      'Modelos locais pelo Ollama, sem crédito',
      'Chave própria da OpenRouter ou da OpenAI, se preferir',
      'Todos os modelos do catálogo (pay per use)',
    ],
  },
  {
    title: 'Pro',
    comingSoon: true,
    items: [
      'Tudo do Plano Free',
      '300 Skills Personalizadas',
      'Workflows salvos e reutilizáveis',
      'Memória de projeto entre sessões',
      'Automações agendadas e execução em nuvem',
      'Modo Design',
      'Franquia mensal de créditos (Vertex AI)',
    ],
  },
  {
    title: 'Teams',
    comingSoon: true,
    items: [
      'Tudo do Plano Pro',
      'As mesmas Skills do Pro, mais as de dinâmica de time',
      'Workflows e memória compartilhados',
      'Créditos compartilhados pelo time',
      'Assessoria Advisor',
    ],
  },
]

export function PlansSection(): React.JSX.Element {
  const { plan } = useConta()

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <LayersIcon className="text-muted-foreground size-4" /> Planos
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = p.title === plan
          return (
            <Card key={p.title} className={`flex flex-col p-6 ${isCurrent ? 'ring-2 ring-amber-500/50' : ''}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold">{p.title}</p>
                {p.comingSoon ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-500">Em breve</Badge>
                ) : (
                  isCurrent && (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-500">Plano atual</Badge>
                  )
                )}
              </div>

              {p.price && !p.comingSoon ? (
                <p className="text-2xl font-semibold">{p.price}</p>
              ) : (
                <p className="text-muted-foreground text-2xl font-semibold">Em breve</p>
              )}

              <ul className="text-muted-foreground mt-4 flex flex-1 flex-col gap-1.5 text-xs">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-1.5">
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Em todos os planos você pode comprar créditos à vontade quando os créditos do plano acabarem.
      </p>
    </div>
  )
}
