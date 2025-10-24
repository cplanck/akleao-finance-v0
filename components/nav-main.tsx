"use client"

import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {items.map((item) => {
            // Exact match for /admin to prevent Overview from being highlighted on all admin pages
            const isActive = pathname === item.url || (item.url !== "/" && item.url !== "/admin" && pathname?.startsWith(item.url))

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  asChild
                  className={cn(
                    "group transition-all duration-300 hover:bg-primary/5",
                    isActive && "bg-primary/10 hover:bg-primary/10"
                  )}
                >
                  <Link href={item.url} className="flex items-center gap-3">
                    {item.icon && (
                      <div className={cn(
                        "p-1.5 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-all duration-300 group-hover:scale-110",
                        isActive && "bg-primary/20 scale-105"
                      )}>
                        <item.icon className={cn(
                          "h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300",
                          isActive && "text-primary"
                        )} />
                      </div>
                    )}
                    <span className={cn(
                      "font-medium group-hover:translate-x-0.5 transition-transform duration-300",
                      isActive && "text-primary font-semibold"
                    )}>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
