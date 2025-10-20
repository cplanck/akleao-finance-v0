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
} from "lucide-react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import Image from "next/image"

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

const data = {
  navMain: [
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
    {
      title: "Admin",
      url: "/admin",
      icon: DatabaseIcon,
    },
  ],
  adminNav: [
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
      title: "ML Models",
      url: "/admin/ml",
      icon: BrainCircuitIcon,
    },
    {
      title: "AI Analyses",
      url: "/admin/ai-analyses",
      icon: SparklesIcon,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedStock?: string
  onSelectStock?: (symbol: string) => void
}

export function AppSidebar({ selectedStock, onSelectStock, ...props }: AppSidebarProps) {
  const { theme, resolvedTheme } = useTheme()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  const { pinnedStocks } = usePinnedStocks()

  // Check if we're in admin view
  const isAdminView = pathname?.startsWith('/admin')

  // Ensure component is mounted before accessing theme
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Determine which logo to show based on current theme
  const currentTheme = resolvedTheme || theme
  const logoSrc = currentTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-border/50 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-2 hover:bg-transparent"
            >
              <a href="/" className="flex items-center gap-2 group">
                {mounted && (
                  <div className="relative">
                    <Image
                      src={logoSrc}
                      alt="Akleao Finance Logo"
                      width={140}
                      height={40}
                      className="object-contain transition-transform duration-300 group-hover:scale-105"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg blur-xl -z-10" />
                  </div>
                )}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {isAdminView ? (
          <NavMain items={data.adminNav} />
        ) : (
          <NavPinnedStocks
            items={pinnedStocks}
            selectedStock={selectedStock}
            onSelectStock={onSelectStock}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
