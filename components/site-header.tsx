"use client"

import { useEffect, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Activity } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"

export function SiteHeader() {
  const [stats, setStats] = useState<{ total_posts: number; tracked_posts: number } | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/reddit/stats`)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      }
    }

    fetchStats()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center justify-between gap-1 px-3 sm:px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Badge variant="outline" className="text-[10px] sm:text-xs flex items-center gap-1">
          <Activity className="h-3 w-3 animate-pulse" />
          {stats ? `Tracking ${stats.tracked_posts.toLocaleString()} posts` : "Loading..."}
        </Badge>
      </div>
    </header>
  )
}
