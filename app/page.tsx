"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import StockSelector from "@/components/stock-selector";
import StockChart from "@/components/stock-chart";
import KeyMetrics from "@/components/key-metrics";
import FundamentalsSummary from "@/components/fundamentals-summary";
import { MarketStatus } from "@/components/market-status";
import { CommandMenu } from "@/components/command-menu";
import { RedditAndResearch } from "@/components/reddit-and-research";
import { fetchStockQuote, fetchStockOverview } from "@/lib/stock-api";

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get stock from URL, default to AAPL
  const stockFromUrl = searchParams.get("symbol") || "AAPL";
  const [selectedStock, setSelectedStock] = useState(stockFromUrl);
  const [dataFetchedAt, setDataFetchedAt] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>("just now");
  const [showFundamentals, setShowFundamentals] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  // Sync URL with selected stock
  useEffect(() => {
    if (stockFromUrl !== selectedStock) {
      setSelectedStock(stockFromUrl);
    }
  }, [stockFromUrl]);

  // Update URL when stock changes
  const handleSelectStock = (symbol: string) => {
    setSelectedStock(symbol);
    router.push(`/?symbol=${symbol}`, { scroll: false });
  };

  const { data: quote, isLoading: quoteLoading, dataUpdatedAt: quoteUpdatedAt } = useQuery({
    queryKey: ["quote", selectedStock],
    queryFn: () => fetchStockQuote(selectedStock),
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["overview", selectedStock],
    queryFn: () => fetchStockOverview(selectedStock),
  });

  // Update dataFetchedAt when quote data is fetched
  useEffect(() => {
    if (quoteUpdatedAt) {
      setDataFetchedAt(new Date(quoteUpdatedAt));
    }
  }, [quoteUpdatedAt]);

  // Update time ago every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(dataFetchedAt));
    }, 10000);

    return () => clearInterval(interval);
  }, [dataFetchedAt]);

  return (
    <SidebarProvider>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onSelectStock={handleSelectStock}
      />
      <AppSidebar
        variant="inset"
        selectedStock={selectedStock}
        onSelectStock={handleSelectStock}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-1.5">
            <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
              {/* Main Content */}
              <div className="px-3 lg:px-4 space-y-3">
        {/* Market Status & Stock Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <MarketStatus />
          <StockSelector
            selectedStock={selectedStock}
            onSelectStock={handleSelectStock}
          />
        </div>

        {/* Chart and Reddit/Research - 50/50 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-3">
          {/* Chart */}
          <div className="h-[400px] sm:h-[500px] md:h-[600px]">
            <StockChart
              symbol={selectedStock}
              quote={quote}
              overview={overview}
              quoteLoading={quoteLoading}
              overviewLoading={overviewLoading}
            />
          </div>

          {/* Reddit Discussions & AI Research */}
          <div className="h-[400px] sm:h-[500px] md:h-[600px]">
            <RedditAndResearch symbol={selectedStock} />
          </div>
        </div>

        {/* Fundamentals Section */}
        <div className="space-y-2.5">
          <button
            onClick={() => setShowFundamentals(!showFundamentals)}
            className="group flex items-center justify-between w-full p-2.5 text-left bg-gradient-to-br from-card/95 via-card/90 to-card/95 backdrop-blur-xl border border-primary/10 rounded-xl hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 relative overflow-hidden"
          >
            {/* Ambient gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="flex items-center gap-2 relative z-10">
              <div className={`h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-all duration-300 ${showFundamentals ? 'rotate-180 scale-110' : 'group-hover:scale-110'}`}>
                <svg
                  className="h-4 w-4 text-primary transition-transform duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">Key Metrics & Fundamentals</span>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Detailed financial analysis and ratios</p>
              </div>
            </div>
            <svg
              className={`h-4 w-4 transition-all duration-300 relative z-10 text-primary ${showFundamentals ? 'rotate-180 scale-110' : 'group-hover:scale-110'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFundamentals && (
            <div className="animate-in slide-in-from-top-4 duration-300 fade-in">
              <KeyMetrics symbol={selectedStock} />
            </div>
          )}
        </div>

        {/* Company Info */}
        <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group">
          {/* Ambient gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

          <CardHeader className="relative z-10 px-3 pt-3 pb-2">
            <CardTitle className="text-lg sm:text-xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              {overviewLoading ? <Skeleton className="h-6 w-48" /> : `About ${overview?.name || selectedStock}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10 px-3 pb-3">
            {overviewLoading ? (
              <>
                <Skeleton className="h-[84px] w-full rounded-lg" />
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Skeleton className="h-[52px] w-full rounded-lg" />
                  <Skeleton className="h-[52px] w-full rounded-lg" />
                  <Skeleton className="h-[52px] w-full rounded-lg" />
                  <Skeleton className="h-[52px] w-full rounded-lg" />
                </div>
              </>
            ) : overview ? (
              <>
                <div className="relative min-h-[84px]">
                  <p className={`text-sm text-muted-foreground leading-relaxed font-medium transition-all duration-300 ${showFullDescription ? '' : 'line-clamp-3'}`}>
                    {overview.description}
                  </p>
                  {overview.description && overview.description.length > 200 && (
                    <button
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-xs text-primary hover:text-primary/80 font-medium mt-1 flex items-center gap-1 transition-colors"
                    >
                      {showFullDescription ? (
                        <>
                          Show less
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          See more
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                  <div className="p-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md h-[52px]">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Sector</span>
                    <p className="font-bold text-sm mt-0.5">{overview.sector}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md h-[52px]">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Industry</span>
                    <p className="font-bold text-sm mt-0.5">{overview.industry}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md h-[52px]">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Employees</span>
                    <p className="font-bold text-sm font-mono tabular-nums mt-0.5">{overview.employees}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md h-[52px]">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Market Cap</span>
                    <p className="font-bold text-sm font-mono tabular-nums mt-0.5">{overview.marketCap}</p>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
