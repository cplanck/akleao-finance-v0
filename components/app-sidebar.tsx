"use client"

import * as React from "react"
import {
  DatabaseIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  FileTextIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  BrainCircuitIcon,
  SparklesIcon,
  SearchIcon,
  LineChartIcon,
  SettingsIcon,
  WandSparklesIcon,
  ShieldIcon,
  HashIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import Image from "next/image"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavPinnedStocks } from "@/components/nav-pinned-stocks"
import { NavUser } from "@/components/nav-user"
import { usePinnedStocks } from "@/hooks/use-pinned-stocks"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedStock?: string
  onSelectStock?: (symbol: string) => void
}

export function AppSidebar({ selectedStock, onSelectStock, ...props }: AppSidebarProps) {
  const { theme, resolvedTheme } = useTheme()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  const { pinnedStocks } = usePinnedStocks()
  const { data: session } = useSession()

  // Check if user is admin based on their role
  const isAdmin = (session?.user as any)?.role === "admin"

  // Debug logging
  React.useEffect(() => {
    console.log("AppSidebar - Full session:", session)
    console.log("AppSidebar - User:", session?.user)
    console.log("AppSidebar - Role:", (session?.user as any)?.role)
    console.log("AppSidebar - Is admin:", isAdmin)
  }, [session, isAdmin])

  // Check if we're in admin view
  const isAdminView = pathname?.startsWith('/admin')

  // Ensure component is mounted before accessing theme
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Determine which logo to show based on current theme
  const currentTheme = resolvedTheme || theme
  const logoSrc = currentTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"

  // Build navigation items based on admin status
  const navItems = [
    {
      title: "Home",
      url: "/",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Research",
      url: "/research",
      icon: SearchIcon,
    },
    {
      title: "Simulations",
      url: "/simulations",
      icon: LineChartIcon,
    },
    ...(isAdmin ? [{
      title: "Admin",
      url: "/admin",
      icon: ShieldIcon,
    }] : []),
  ]

  const adminNavItems = [
    {
      title: "Overview",
      url: "/admin",
      icon: LayoutGridIcon,
    },
    {
      title: "Posts",
      url: "/admin/posts",
      icon: FileTextIcon,
    },
    {
      title: "Comments",
      url: "/admin/comments",
      icon: MessageSquareIcon,
    },
    {
      title: "Stocks",
      url: "/admin/stocks",
      icon: TrendingUpIcon,
    },
    {
      title: "Subreddits",
      url: "/admin/tracked-subreddits",
      icon: HashIcon,
    },
    {
      title: "Prompts",
      url: "/admin/prompts",
      icon: WandSparklesIcon,
    },
    {
      title: "ML Models",
      url: "/admin/ml",
      icon: BrainCircuitIcon,
    },
    {
      title: "AI Analyses",
      url: "/admin/ai-analyses",
      icon: SparklesIcon,
    },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r hidden md:flex" {...props}>
      <SidebarHeader className="border-b border-border/40 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-2 hover:bg-transparent"
            >
              <Link href="/" className="flex items-center gap-2 group">
                {mounted && (
                  <div className="relative">
                    <Image
                      src={logoSrc}
                      alt="Akleao Finance Logo"
                      width={140}
                      height={40}
                      className="object-contain transition-transform duration-300 group-hover:scale-105 p-2"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg blur-xl -z-10" />
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <NavMain items={navItems} />
        {isAdminView && isAdmin && (
          <NavMain items={adminNavItems} />
        )}
        {!isAdminView && (
          <NavPinnedStocks
            items={pinnedStocks}
            selectedStock={selectedStock}
            onSelectStock={onSelectStock}
          />
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40 pt-4">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
