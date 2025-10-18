"use client"

import * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavPinnedStocks } from "@/components/nav-pinned-stocks"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Markets",
      url: "#",
      icon: BarChartIcon,
    },
    {
      title: "Watchlist",
      url: "#",
      icon: ListIcon,
    },
    {
      title: "Portfolio",
      url: "#",
      icon: FolderIcon,
    },
    {
      title: "Research",
      url: "#",
      icon: SearchIcon,
    },
    {
      title: "Admin",
      url: "/admin",
      icon: DatabaseIcon,
    },
  ],
  navClouds: [
    {
      title: "Sectors",
      icon: FolderIcon,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Technology",
          url: "#",
        },
        {
          title: "Healthcare",
          url: "#",
        },
        {
          title: "Finance",
          url: "#",
        },
      ],
    },
    {
      title: "Learning",
      icon: FileTextIcon,
      url: "#",
      items: [
        {
          title: "Beginner's Guide",
          url: "#",
        },
        {
          title: "Financial Terms",
          url: "#",
        },
      ],
    },
    {
      title: "News",
      icon: FileIcon,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: SettingsIcon,
    },
    {
      title: "Get Help",
      url: "#",
      icon: HelpCircleIcon,
    },
    {
      title: "Search",
      url: "#",
      icon: SearchIcon,
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: DatabaseIcon,
    },
    {
      name: "Reports",
      url: "#",
      icon: ClipboardListIcon,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: FileIcon,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedStock?: string
  onSelectStock?: (symbol: string) => void
}

export function AppSidebar({ selectedStock, onSelectStock, ...props }: AppSidebarProps) {
  const pinnedStocks = [
    { symbol: "AAPL" },
    { symbol: "MSFT" },
    { symbol: "GOOGL" },
    { symbol: "TSLA" },
    { symbol: "NVDA" },
    { symbol: "AMZN" },
    { symbol: "META" },
    { symbol: "NFLX" },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">Akleao Finance</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavPinnedStocks
          items={pinnedStocks}
          selectedStock={selectedStock}
          onSelectStock={onSelectStock}
        />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
