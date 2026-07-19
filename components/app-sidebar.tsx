'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheckIcon } from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import { AxiomaLogo } from '@/components/AxiomaLogo'
import { useConta } from '@/lib/conta-context'
import { NAV_SECTIONS } from '@/lib/conta-nav'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>): React.JSX.Element {
  const { name, email, isAdmin, signOut } = useConta()
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />}>
              <AxiomaLogo id="sidebar" className="size-4 shrink-0" />
              <span className="font-brand truncate text-base italic group-data-[collapsible=icon]:hidden">Axyoma</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={NAV_SECTIONS} />
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/conta/admin/dev" />} isActive={pathname.startsWith('/conta/admin/dev')} tooltip="Dev">
                  <ShieldCheckIcon />
                  <span>Dev</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser name={name} email={email} onSignOut={signOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
