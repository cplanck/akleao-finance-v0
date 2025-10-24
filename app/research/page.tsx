"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import StockChart from "@/components/stock-chart";
import KeyMetrics from "@/components/key-metrics";
import FundamentalsSummary from "@/components/fundamentals-summary";
import { RedditAndResearch } from "@/components/reddit-and-research";
import { fetchStockQuote, fetchStockOverview } from "@/lib/stock-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TrendingUp, X } from "lucide-react";
import { usePolygonWebSocket } from "@/hooks/use-polygon-websocket";
import { usePinnedStocks } from "@/hooks/use-pinned-stocks";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

function ResearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pinnedStocks, unpin } = usePinnedStocks();

  // Get stock from URL, default to first pinned stock or AAPL
  const defaultStock = pinnedStocks.length > 0 ? pinnedStocks[0].symbol : "AAPL";
  const stockFromUrl = searchParams.get("symbol") || defaultStock;
  const [selectedStock, setSelectedStock] = useState(stockFromUrl);
  const [dataFetchedAt, setDataFetchedAt] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>("just now");
  const [showFundamentals, setShowFundamentals] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState<{ market: string; afterHours: boolean; earlyHours: boolean } | null>(null);

  // Sync URL with selected stock
  useEffect(() => {
    if (stockFromUrl !== selectedStock) {
      setSelectedStock(stockFromUrl);
    }
  }, [stockFromUrl]);

  // Update URL when stock changes
  const handleSelectStock = (symbol: string) => {
    setSelectedStock(symbol);
    router.push(`/research?symbol=${symbol}`, { scroll: false });
  };

  // Fetch market status
  useEffect(() => {
    const fetchMarketStatus = async () => {
      try {
        const response = await fetch("/api/market/status");
        const data = await response.json();
        setMarketStatus(data);
      } catch (error) {
        console.error("Error fetching market status:", error);
      }
    };

    fetchMarketStatus();
    // Refresh market status every minute
    const interval = setInterval(fetchMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Determine if we should use live WebSocket prices
  const shouldUseLivePrice = marketStatus?.market === "open" || marketStatus?.afterHours || marketStatus?.earlyHours;

  const { data: quote, isLoading: quoteLoading, dataUpdatedAt: quoteUpdatedAt, isFetching: quoteFetching } = useQuery({
    queryKey: ["quote", selectedStock],
    queryFn: () => fetchStockQuote(selectedStock),
    // Poll every 2 seconds when market is open (WebSocket disabled due to subscription requirements)
    refetchInterval: shouldUseLivePrice ? 2000 : false,
    staleTime: 2000,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["overview", selectedStock],
    queryFn: () => fetchStockOverview(selectedStock),
  });

  const queryClient = useQueryClient();

  // Throttle WebSocket updates to avoid too many re-renders
  const lastUpdateRef = useRef<number>(0);
  const updateThrottleMs = 1000; // Update UI at most once per second

  // Use WebSocket for live price updates during market hours
  const { latestTrade, isConnected } = usePolygonWebSocket({
    symbol: selectedStock,
    enabled: false, // Disabled: Polygon WebSocket requires paid subscription
    onTrade: (trade) => {
      const now = Date.now();

      // Throttle updates to prevent too many re-renders
      if (now - lastUpdateRef.current < updateThrottleMs) {
        return;
      }
      lastUpdateRef.current = now;

      // Update the quote in the cache with the latest trade price
      queryClient.setQueryData(["quote", selectedStock], (oldQuote: any) => {
        if (!oldQuote) return oldQuote;

        // Use the previous day's close as the reference price for change calculation
        const referencePrice = oldQuote.regularMarket?.price || oldQuote.price;
        const newPrice = trade.price;
        const change = newPrice - referencePrice;
        const changePercent = (change / referencePrice) * 100;

        return {
          ...oldQuote,
          price: newPrice,
          change,
          changePercent,
        };
      });

      // Update the data fetched timestamp
      setDataFetchedAt(new Date(trade.timestamp));
    },
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
      <AppSidebar
        variant="inset"
        selectedStock={selectedStock}
        onSelectStock={handleSelectStock}
      />
      <SidebarInset>
        <SiteHeader onSimulateClick={() => setSimulateDialogOpen(true)} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-1.5 pb-20 md:pb-0">
            <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
              {/* Pinned Stocks Row - Mobile Only */}
              {pinnedStocks.length > 0 && (
                <div className="lg:hidden px-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {pinnedStocks.map((stock) => (
                      <div
                        key={stock.symbol}
                        className={cn(
                          "flex-shrink-0 cursor-pointer transition-all duration-200 group relative rounded-lg border",
                          selectedStock === stock.symbol
                            ? "bg-primary/10 border-primary/30 shadow-md"
                            : "bg-card/50 border-border/40 hover:border-primary/20 hover:bg-muted/50"
                        )}
                        onClick={() => handleSelectStock(stock.symbol)}
                      >
                        <div className="flex items-center px-2.5 py-1.5">
                          <span className={cn(
                            "font-bold text-xs tracking-tight",
                            selectedStock === stock.symbol
                              ? "text-primary"
                              : "text-foreground"
                          )}>
                            {stock.symbol}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="px-3 lg:px-4 space-y-3">
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
              isLiveUpdating={shouldUseLivePrice && isConnected}
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
                  <div className="py-2.5 px-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md flex flex-col justify-center">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Sector</span>
                    <p className="font-bold text-sm mt-0.5">{overview.sector}</p>
                  </div>
                  <div className="py-2.5 px-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md flex flex-col justify-center">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Industry</span>
                    <p className="font-bold text-sm mt-0.5">{overview.industry}</p>
                  </div>
                  <div className="py-2.5 px-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md flex flex-col justify-center">
                    <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Employees</span>
                    <p className="font-bold text-sm font-mono tabular-nums mt-0.5">{overview.employees}</p>
                  </div>
                  <div className="py-2.5 px-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-md flex flex-col justify-center">
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

      {/* Simulate Position Dialog */}
      <SimulatePositionDialog
        open={simulateDialogOpen}
        onClose={() => setSimulateDialogOpen(false)}
        symbol={selectedStock}
        currentPrice={quote?.price}
      />
      <MobileNav />
    </SidebarProvider>
  );
}

// Simulate Position Dialog Component
function SimulatePositionDialog({
  open,
  onClose,
  symbol,
  currentPrice,
}: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inputType, setInputType] = useState<"shares" | "dollars">("dollars");
  const [inputValue, setInputValue] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch SPY quote for comparison
  const { data: spyQuote } = useQuery({
    queryKey: ["quote", "SPY"],
    queryFn: () => fetchStockQuote("SPY"),
    enabled: open,
  });

  const shares = inputType === "shares"
    ? parseFloat(inputValue) || 0
    : currentPrice ? (parseFloat(inputValue) || 0) / currentPrice : 0;

  const totalValue = currentPrice ? shares * currentPrice : 0;
  const investmentAmount = inputType === "dollars" ? (parseFloat(inputValue) || 0) : totalValue;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create position");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Position created!", {
        description: `Successfully created simulated position for ${symbol}`,
      });
      onClose();
      router.push("/simulations");
    },
    onError: (error: any) => {
      toast.error("Error", {
        description: error.message || "Failed to create position",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPrice) {
      toast.error("Error", {
        description: "Current price not available",
      });
      return;
    }

    if (shares <= 0) {
      toast.error("Error", {
        description: "Please enter a valid amount",
      });
      return;
    }

    createMutation.mutate({
      stock_symbol: symbol,
      shares: shares,
      entry_price: currentPrice,
      entry_date: new Date().toISOString(),
      notes: notes || null,
    });
  };

  // Calculate SPY comparison
  const getSpyComparison = () => {
    if (!spyQuote || !currentPrice || !investmentAmount || investmentAmount === 0) return null;

    // Calculate how many SPY shares the same investment would buy
    const spyShares = investmentAmount / spyQuote.price;

    return {
      spyPrice: spyQuote.price,
      spyShares,
      stockShares: shares,
      investmentAmount,
    };
  };

  const spyComparison = getSpyComparison();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate Position: ${symbol}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Price Display */}
          <div className="p-3 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/10">
            <div className="text-xs text-muted-foreground font-semibold mb-1">Current Price</div>
            <div className="text-2xl font-bold font-mono">
              ${currentPrice?.toFixed(2) || "Loading..."}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Investment Type</Label>
            <RadioGroup value={inputType} onValueChange={(v) => setInputType(v as "shares" | "dollars")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dollars" id="dollars" />
                <Label htmlFor="dollars" className="font-normal cursor-pointer">Dollar Amount</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="shares" id="shares" />
                <Label htmlFor="shares" className="font-normal cursor-pointer">Number of Shares</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount">
              {inputType === "dollars" ? "Dollar Amount" : "Number of Shares"}
            </Label>
            <Input
              id="amount"
              type="number"
              step={inputType === "dollars" ? "0.01" : "0.001"}
              min="0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputType === "dollars" ? "$1,000.00" : "10"}
              required
            />
          </div>

          {currentPrice && inputValue && (
            <>
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares:</span>
                  <span className="font-mono font-semibold">{shares.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Value:</span>
                  <span className="font-mono font-semibold">${totalValue.toFixed(2)}</span>
                </div>
              </div>

              {/* SPY Comparison */}
              {spyComparison && spyQuote && (
                <div className="p-3 bg-gradient-to-br from-blue-500/5 to-blue-600/5 rounded-lg border border-blue-500/10">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Benchmark Comparison
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    For ${investmentAmount.toFixed(2)}, you could buy <span className="font-semibold text-foreground">{spyComparison.stockShares.toFixed(3)} shares of {symbol}</span> or <span className="font-semibold text-foreground">{spyComparison.spyShares.toFixed(3)} shares of SPY</span> (S&amp;P 500 ETF).
                  </p>
                  <div className="mt-2 pt-2 border-t border-blue-500/10 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">SPY Price</div>
                      <div className="font-mono font-semibold">${spyComparison.spyPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{symbol} Price</div>
                      <div className="font-mono font-semibold">${currentPrice.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you simulating this position?"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={createMutation.isPending || !currentPrice}
            >
              {createMutation.isPending ? "Creating..." : "Create Position"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <ResearchContent />
    </Suspense>
  );
}
