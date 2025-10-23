"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SparklesIcon,
  SearchIcon,
  LineChartIcon,
  DatabaseIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    title: "Research",
    href: "/research",
    icon: SearchIcon,
  },
  {
    title: "For You",
    href: "/",
    icon: SparklesIcon,
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
  const [isScrolled, setIsScrolled] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Show compact version when scrolling down, full when scrolling up or at top
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="px-4 pb-4 pointer-events-none">
        <div className={cn(
          "pointer-events-auto rounded-2xl border border-border/40 bg-background/50 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40 shadow-lg transition-all duration-300",
          isScrolled ? "scale-95" : "scale-100"
        )}>
          <div className={cn(
            "flex items-center justify-around px-2 transition-all duration-300",
            isScrolled ? "h-14" : "h-16"
          )}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl transition-all duration-200 min-w-[4rem]",
                    isScrolled ? "gap-0 px-3 py-2" : "gap-1 px-3 py-2",
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
                      "transition-all duration-200",
                      isScrolled ? "h-4 w-4" : "h-5 w-5",
                      isActive && "fill-primary/10"
                    )} />
                    {isActive && (
                      <div className="absolute inset-0 bg-primary/10 rounded-full blur-md -z-10" />
                    )}
                  </div>
                  <span className={cn(
                    "font-medium transition-all duration-200",
                    isScrolled ? "text-[0px] h-0 leading-[0]" : "text-[10px] opacity-100",
                    isActive && "font-semibold"
                  )}>
                    {item.title}
                  </span>
                </Link>
              )
            })}
          </div>
          {/* Bottom safe area for iOS */}
          <div className="h-[env(safe-area-inset-bottom)] rounded-b-2xl" />
        </div>
      </div>
    </nav>
  )
}
