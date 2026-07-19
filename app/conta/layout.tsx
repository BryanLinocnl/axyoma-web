'use client'

import { usePathname } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { ContaProvider, useConta } from '@/lib/conta-context'
import { AppSidebar } from '@/components/app-sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { findNavPath } from '@/lib/conta-nav'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

const FALLBACK_TITLES: Record<string, { group: string; page: string }> = {
  '/conta/admin/dev': { group: 'Admin', page: 'Dev' },
}

export default function ContaLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ContaProvider>
      <ContaShell>{children}</ContaShell>
    </ContaProvider>
  )
}

function ContaShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { authReady, loading, plan } = useConta()
  const pathname = usePathname()
  const crumb = findNavPath(pathname) ?? FALLBACK_TITLES[pathname] ?? { group: 'Conta', page: 'Conta' }

  // Só bloqueia até a SESSÃO ser resolvida (rápido, localStorage) — não até os
  // dados carregarem. Assim o shell + conteúdo (h1) pintam cedo (LCP baixo).
  if (!authReady) {
    return <main className="bg-background text-muted-foreground flex min-h-screen items-center justify-center text-sm">Carregando…</main>
  }

  return (
    <SidebarProvider className="bg-background text-foreground">
      <AppSidebar />
      <SidebarInset className="bg-background text-foreground">
        <header className="border-border flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">{crumb.group}</BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{crumb.page}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <div className="border-border bg-card flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
              <BadgeCheck className="size-3.5 text-amber-500" />
              {loading ? <span className="bg-muted h-3 w-16 animate-pulse rounded" /> : <>Plano {plan}</>}
            </div>
            <ModeToggle />
          </div>
        </header>
        {/* Chat usa largura cheia (painel de conversas + coluna do chat); demais
            páginas ficam na coluna central de leitura. */}
        <main
          className={
            pathname === '/conta/playground/chat'
              ? 'min-h-0 flex-1'
              : 'mx-auto w-full max-w-5xl flex-1 px-6 py-8'
          }
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
