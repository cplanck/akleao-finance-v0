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
      <SidebarGroupLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 px-3 py-2">
        <div className="p-1 rounded-md bg-primary/10">
          <Pin className="h-3 w-3 text-primary" />
        </div>
        Pinned Stocks
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">No pinned stocks yet</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Pin stocks to quick access</p>
            </div>
          ) : (
            items.map((item) => {
              const isPositive = (item.change || 0) >= 0
              const isSelected = selectedStock === item.symbol

              return (
                <SidebarMenuItem key={item.symbol}>
                  <SidebarMenuButton
                    tooltip={item.symbol}
                    onClick={() => onSelectStock?.(item.symbol)}
                    isActive={isSelected}
                    className={cn(
                      "cursor-pointer group transition-all duration-300 relative overflow-hidden",
                      isSelected && "bg-primary/10 shadow-sm",
                      !isSelected && "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={cn(
                        "font-semibold text-sm transition-all duration-300",
                        isSelected && "text-primary",
                        !isSelected && "group-hover:translate-x-0.5"
                      )}>
                        {item.symbol}
                      </span>
                      {item.change !== undefined && (
                        <span
                          className={cn(
                            "ml-auto text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full",
                            isPositive ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                          )}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                          )}
                          {Math.abs(item.change).toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
