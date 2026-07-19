'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import type { NavGroup, NavSection } from '@/lib/conta-nav'

export function NavMain({ sections }: { sections: NavSection[] }): React.JSX.Element {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()
  const iconOnly = state === 'collapsed' && !isMobile

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
          <SidebarMenu>
            {section.groups.map((group) =>
              iconOnly ? (
                <CollapsedGroup key={group.title} group={group} pathname={pathname} />
              ) : (
                <ExpandedGroup key={group.title} group={group} pathname={pathname} />
              )
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}

function ExpandedGroup({ group, pathname }: { group: NavGroup; pathname: string }): React.JSX.Element {
  const isGroupActive = group.items.some((item) => pathname === item.url)
  const [open, setOpen] = useState(isGroupActive)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reabre o grupo ao navegar pra uma página dele por URL direta
    if (isGroupActive) setOpen(true)
  }, [isGroupActive])
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible" render={<SidebarMenuItem />}>
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={group.title} isActive={isGroupActive} />}>
        <group.icon />
        <span>{group.title}</span>
        <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {group.items.map((item) => (
            <SidebarMenuSubItem key={item.url}>
              <SidebarMenuSubButton render={<Link href={item.url} />} isActive={pathname === item.url}>
                <span>{item.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Sidebar colapsada: ícone não some — vira botão que abre um popover com as
// páginas do grupo (accordion normal fica invisível quando encolhido).
function CollapsedGroup({ group, pathname }: { group: NavGroup; pathname: string }): React.JSX.Element {
  const isGroupActive = group.items.some((item) => pathname === item.url)
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuButton tooltip={group.title} isActive={isGroupActive} className="aria-expanded:bg-sidebar-accent" />}>
          <group.icon />
          <span>{group.title}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-48">
          <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
          {group.items.map((item) => (
            <DropdownMenuItem
              key={item.url}
              render={<Link href={item.url} />}
              className={pathname === item.url ? 'bg-accent text-accent-foreground' : undefined}
            >
              {item.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
