"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Search, TrendingUp } from "lucide-react"
import { MarketStatus } from "@/components/market-status"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"

interface SiteHeaderProps {
  onSimulateClick?: () => void;
}

export function SiteHeader({ onSimulateClick }: SiteHeaderProps = {}) {
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
      <div className="flex w-full items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 lg:gap-6 lg:px-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] sm:text-xs flex items-center gap-1">
            <Activity className="h-3 w-3 animate-pulse" />
            {stats ? `Tracking ${stats.tracked_posts.toLocaleString()} posts` : "Loading..."}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              // Trigger Cmd+K
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true
              });
              document.dispatchEvent(event);
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
          {onSimulateClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSimulateClick}
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          )}
          <MarketStatus />
        </div>
      </div>
    </header>
  )
}
