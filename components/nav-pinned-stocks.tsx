"use client"

import { Pin, TrendingUp, TrendingDown } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface PinnedStock {
  symbol: string
  change?: number
}

export function NavPinnedStocks({
  items,
  selectedStock,
  onSelectStock,
}: {
  items: PinnedStock[]
  selectedStock?: string
  onSelectStock?: (symbol: string) => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <Pin className="h-4 w-4" />
        Pinned Stocks
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isPositive = (item.change || 0) >= 0
            const isSelected = selectedStock === item.symbol

            return (
              <SidebarMenuItem key={item.symbol}>
                <SidebarMenuButton
                  tooltip={item.symbol}
                  onClick={() => onSelectStock?.(item.symbol)}
                  isActive={isSelected}
                  className={cn(
                    "cursor-pointer",
                    isSelected && "bg-sidebar-accent"
                  )}
                >
                  <span className="font-semibold">{item.symbol}</span>
                  {item.change !== undefined && (
                    <span
                      className={cn(
                        "ml-auto text-xs flex items-center gap-1",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(item.change).toFixed(2)}%
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
