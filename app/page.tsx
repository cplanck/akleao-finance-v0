"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import StockSelector from "@/components/stock-selector";
import StockChart from "@/components/stock-chart";
import KeyMetrics from "@/components/key-metrics";
import FundamentalsSummary from "@/components/fundamentals-summary";
import { MarketStatus } from "@/components/market-status";
import { CommandMenu } from "@/components/command-menu";
import { RedditSentiment } from "@/components/reddit-sentiment";
import { ResearchGenerator } from "@/components/research-generator";
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
  const [selectedStock, setSelectedStock] = useState("AAPL");
  const [dataFetchedAt, setDataFetchedAt] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>("just now");
  const [showFundamentals, setShowFundamentals] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

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
        onSelectStock={setSelectedStock}
      />
      <AppSidebar
        variant="inset"
        selectedStock={selectedStock}
        onSelectStock={setSelectedStock}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {/* Main Content */}
              <div className="px-4 lg:px-6 space-y-6">
        {/* Market Status & Stock Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <MarketStatus />
          <StockSelector
            selectedStock={selectedStock}
            onSelectStock={setSelectedStock}
          />
        </div>

        {/* AI Fundamentals Summary */}
        <FundamentalsSummary symbol={selectedStock} />

        {/* Chart and Reddit Discussions - 50/50 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Chart */}
          <div className="relative">
            <StockChart
              symbol={selectedStock}
              quote={quote}
              overview={overview}
              quoteLoading={quoteLoading}
              overviewLoading={overviewLoading}
            />
          </div>

          {/* Reddit Discussions */}
          <RedditSentiment symbol={selectedStock} limit={5} />
        </div>

        {/* Fundamentals Section */}
        <div className="space-y-4">
          <button
            onClick={() => setShowFundamentals(!showFundamentals)}
            className="group flex items-center justify-between w-full p-5 text-left bg-gradient-to-br from-card/95 via-card/90 to-card/95 backdrop-blur-xl border border-primary/10 rounded-xl hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 relative overflow-hidden"
          >
            {/* Ambient gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-all duration-300 ${showFundamentals ? 'rotate-180 scale-110' : 'group-hover:scale-110'}`}>
                <svg
                  className="h-5 w-5 text-primary transition-transform duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">Key Metrics & Fundamentals</span>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Detailed financial analysis and ratios</p>
              </div>
            </div>
            <svg
              className={`h-5 w-5 transition-all duration-300 relative z-10 text-primary ${showFundamentals ? 'rotate-180 scale-110' : 'group-hover:scale-110'}`}
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

        {/* Research Report Generator */}
        <ResearchGenerator symbol={selectedStock} />

        {/* Company Info */}
        {overview && (
          <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group">
            {/* Ambient gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

            <CardHeader className="relative z-10">
              <CardTitle className="text-lg sm:text-xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                About {overview.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {overview.description}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                  <span className="text-muted-foreground text-xs sm:text-sm font-semibold uppercase tracking-wide">Sector</span>
                  <p className="font-bold text-sm sm:text-base mt-1">{overview.sector}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                  <span className="text-muted-foreground text-xs sm:text-sm font-semibold uppercase tracking-wide">Industry</span>
                  <p className="font-bold text-sm sm:text-base mt-1">{overview.industry}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                  <span className="text-muted-foreground text-xs sm:text-sm font-semibold uppercase tracking-wide">Employees</span>
                  <p className="font-bold text-sm sm:text-base mt-1">{overview.employees}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                  <span className="text-muted-foreground text-xs sm:text-sm font-semibold uppercase tracking-wide">Market Cap</span>
                  <p className="font-bold text-sm sm:text-base mt-1">{overview.marketCap}</p>
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
