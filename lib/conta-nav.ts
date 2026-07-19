import type { ComponentType } from 'react'
import {
  LayoutDashboardIcon,
  TerminalSquareIcon,
  CreditCardIcon,
  UserIcon,
  RocketIcon,
  ListChecksIcon,
  CodeIcon,
  PenToolIcon,
  PuzzleIcon,
} from 'lucide-react'

export type NavPage = { title: string; url: string }
export type NavGroup = { title: string; icon: ComponentType<{ className?: string }>; items: NavPage[] }
export type NavSection = { title: string; groups: NavGroup[] }

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Dashboard',
    groups: [
      {
        title: 'Visão Geral',
        icon: LayoutDashboardIcon,
        items: [
          { title: 'Visão Geral', url: '/conta/visao-geral/visao-geral' },
          { title: 'Uso', url: '/conta/visao-geral/uso' },
          { title: 'Modelos', url: '/conta/visao-geral/modelos' },
          { title: 'Integrações', url: '/conta/visao-geral/integracoes' },
        ],
      },
      {
        title: 'Playground',
        icon: TerminalSquareIcon,
        items: [
          { title: 'Chat', url: '/conta/playground/chat' },
          // 'Imagens' oculto temporariamente (rota travada no middleware.ts). Reativar depois.
          { title: 'Reportar erros', url: '/conta/playground/logs' },
        ],
      },
      {
        title: 'Faturamento',
        icon: CreditCardIcon,
        items: [{ title: 'Faturamento', url: '/conta/faturamento/creditos' }],
      },
      {
        title: 'Sua conta',
        icon: UserIcon,
        items: [{ title: 'Sua conta', url: '/conta/sua-conta/sua-conta' }],
      },
    ],
  },
  {
    title: 'Documentação',
    groups: [
      {
        title: 'Começando',
        icon: RocketIcon,
        items: [
          { title: 'Por onde começar', url: '/conta/comecando/por-onde-comecar' },
          { title: 'Quais modelos usar', url: '/conta/comecando/quais-modelos-usar' },
          { title: 'Ranking de modelos', url: '/conta/comecando/ranking-de-modelos' },
        ],
      },
      {
        title: 'Plan Mode',
        icon: ListChecksIcon,
        items: [{ title: 'Como funciona o Plan Mode', url: '/conta/plan-mode/como-funciona' }],
      },
      {
        title: 'Code Mode',
        icon: CodeIcon,
        items: [{ title: 'Como funciona o Code Mode', url: '/conta/code-mode/como-funciona' }],
      },
      {
        title: 'Design Mode',
        icon: PenToolIcon,
        items: [{ title: 'Como funciona o Design Mode', url: '/conta/design-mode/como-funciona' }],
      },
      {
        title: 'Skills',
        icon: PuzzleIcon,
        items: [{ title: 'Como criar skills', url: '/conta/skills/como-criar' }],
      },
    ],
  },
]

/** Acha grupo+página do pathname atual, pra montar o breadcrumb sem título ambíguo. */
export function findNavPath(pathname: string): { group: string; page: string } | null {
  for (const section of NAV_SECTIONS) {
    for (const group of section.groups) {
      const page = group.items.find((item) => item.url === pathname)
      if (page) return { group: group.title, page: page.title }
    }
  }
  return null
}
