"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  SearchIcon,
  LineChartIcon,
  DatabaseIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    title: "Home",
    href: "/",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Research",
    href: "/research",
    icon: SearchIcon,
  },
  {
    title: "Simulations",
    href: "/simulations",
    icon: LineChartIcon,
  },
  {
    title: "Admin",
    href: "/admin",
    icon: DatabaseIcon,
  },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[4rem]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center transition-all duration-200",
                isActive && "scale-110"
              )}>
                <Icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive && "fill-primary/10"
                )} />
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 rounded-full blur-md -z-10" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "font-semibold"
              )}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
      {/* Bottom safe area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)] bg-background/95" />
    </nav>
  )
}
