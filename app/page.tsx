"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import StockSelector from "@/components/stock-selector";
import StockChart from "@/components/stock-chart";
import KeyMetrics from "@/components/key-metrics";
import { fetchStockQuote, fetchStockOverview } from "@/lib/stock-api";
import { SECTOR_COLORS } from "@/lib/sp500-stocks";
import { cn } from "@/lib/utils";

export default function Home() {
  const [selectedStock, setSelectedStock] = useState("AAPL");

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["quote", selectedStock],
    queryFn: () => fetchStockQuote(selectedStock),
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["overview", selectedStock],
    queryFn: () => fetchStockOverview(selectedStock),
  });

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {/* Main Content */}
              <div className="px-4 lg:px-6 space-y-6">
        {/* Stock Selector */}
        <StockSelector
          selectedStock={selectedStock}
          onSelectStock={setSelectedStock}
        />

        {/* Stock Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
              <div className="space-y-2 flex-1">
                <CardTitle className="text-2xl sm:text-3xl">
                  {overviewLoading ? "Loading..." : overview?.name || "Apple Inc."}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    {selectedStock}
                  </p>
                  {overview && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          SECTOR_COLORS[overview.sector] ||
                            "bg-gray-500/10 text-gray-500"
                        )}
                      >
                        {overview.sector}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {overview.industry}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-2xl sm:text-3xl font-bold">
                  {quoteLoading ? "..." : `$${quote?.price.toFixed(2)}`}
                </div>
                <div
                  className={`text-sm flex items-center sm:justify-end gap-1 ${
                    (quote?.change || 0) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  <span>{(quote?.change || 0) >= 0 ? "↗" : "↘"}</span>
                  <span>
                    {quote?.change.toFixed(2)} ({quote?.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stock Chart */}
        <StockChart symbol={selectedStock} />

        {/* Key Metrics */}
        <KeyMetrics symbol={selectedStock} />

        {/* Company Info */}
        {overview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">About {overview.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {overview.description}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Sector</span>
                  <p className="font-medium text-sm sm:text-base">{overview.sector}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Industry</span>
                  <p className="font-medium text-sm sm:text-base">{overview.industry}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Employees</span>
                  <p className="font-medium text-sm sm:text-base">{overview.employees}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Market Cap</span>
                  <p className="font-medium text-sm sm:text-base">{overview.marketCap}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
