"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { SearchIcon, TrendingUpIcon, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SP500_STOCKS, SECTOR_COLORS } from "@/lib/sp500-stocks";
import { Badge } from "@/components/ui/badge";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStock?: (symbol: string) => void;
}

interface SearchResult {
  symbol: string;
  name: string;
  sector: string;
  exchange?: string;
}

// Popular stocks for quick access
const POPULAR_STOCK_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX"];
const POPULAR_STOCKS = SP500_STOCKS.filter(stock => POPULAR_STOCK_SYMBOLS.includes(stock.symbol));

export function CommandMenu({ open, onOpenChange, onSelectStock }: CommandMenuProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const recentSearchesRef = React.useRef<string[]>([]);

  // Load recent searches from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem("recentStockSearches");
    if (stored) {
      const parsed = JSON.parse(stored);
      setRecentSearches(parsed);
      recentSearchesRef.current = parsed;
    }
  }, []);

  // Keep ref in sync with state
  React.useEffect(() => {
    recentSearchesRef.current = recentSearches;
  }, [recentSearches]);

  // Get recent stock data - fetch from API for stocks not in SP500_STOCKS
  const [recentStocksData, setRecentStocksData] = React.useState<SearchResult[]>([]);

  React.useEffect(() => {
    if (recentSearches.length === 0) {
      setRecentStocksData([]);
      return;
    }

    const fetchRecentStocks = async () => {
      const stocksData: SearchResult[] = [];

      for (const symbol of recentSearches) {
        // First try to find in SP500_STOCKS for instant display
        const sp500Stock = SP500_STOCKS.find(s => s.symbol === symbol);
        if (sp500Stock) {
          stocksData.push({
            symbol: sp500Stock.symbol,
            name: sp500Stock.name,
            sector: sp500Stock.sector,
          });
        } else {
          // If not in SP500, fetch from API
          try {
            const response = await fetch(`/api/stock/overview?symbol=${symbol}`);
            if (response.ok) {
              const data = await response.json();
              stocksData.push({
                symbol: data.symbol,
                name: data.name,
                sector: data.sector,
              });
            }
          } catch (error) {
            console.error(`Error fetching stock data for ${symbol}:`, error);
            // Add as symbol only if fetch fails
            stocksData.push({
              symbol: symbol,
              name: symbol,
              sector: "Unknown",
            });
          }
        }
      }

      setRecentStocksData(stocksData);
    };

    fetchRecentStocks();
  }, [recentSearches]);

  // Autofocus input when dialog opens and clear search when closed
  React.useEffect(() => {
    if (open) {
      // Set default selected value to first recent search if available
      if (recentStocksData.length > 0) {
        setSelectedValue(recentStocksData[0].symbol);
      } else if (POPULAR_STOCKS.length > 0) {
        setSelectedValue(POPULAR_STOCKS[0].symbol);
      }

      // Multiple attempts to ensure focus works
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      };

      // Try immediately
      focusInput();

      // Try after animation frame
      requestAnimationFrame(() => {
        focusInput();
      });

      // Try after a short delay as backup
      const timeoutId = setTimeout(focusInput, 100);

      return () => clearTimeout(timeoutId);
    } else {
      setSearch("");
      setSelectedValue("");
    }
  }, [open, recentStocksData]);

  const handleSelect = React.useCallback((symbol: string) => {
    // Save to recent searches using ref to get current value
    const updated = [symbol, ...recentSearchesRef.current.filter(s => s !== symbol)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentStockSearches", JSON.stringify(updated));

    // Close dialog first
    onOpenChange(false);

    // Navigate or callback
    if (onSelectStock) {
      onSelectStock(symbol);
    } else {
      router.push(`/research?symbol=${symbol}`);
    }
  }, [onSelectStock, router, onOpenChange]);

  // Handle Cmd+K to open/close
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Search stocks via API with debounce
  React.useEffect(() => {
    if (!search || search.length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/stock/search?q=${encodeURIComponent(search)}`);
        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [search]);

  // Global escape handler
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape, { capture: true });
      return () => document.removeEventListener("keydown", handleEscape, { capture: true });
    }
  }, [open, onOpenChange]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in-0"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
        />
      )}

      {/* Command Palette */}
      <Command
        className={cn(
          "fixed left-[50%] top-[40%] z-[60] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%]",
          "rounded-xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl",
          "overflow-hidden transition-all duration-200",
          open ? "animate-in fade-in-0 zoom-in-95" : "hidden"
        )}
        loop
        shouldFilter={false}
        value={selectedValue}
        onValueChange={setSelectedValue}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-primary/10 px-4">
          <SearchIcon className="mr-2 h-5 w-5 shrink-0 text-muted-foreground" />
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Search stocks by symbol or name..."
            autoFocus
            className="flex h-14 w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <kbd
            className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-primary/20 bg-primary/5 px-2 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
            onClick={() => onOpenChange(false)}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No stocks found.
          </Command.Empty>

          {/* Recent Searches */}
          {recentStocksData.length > 0 && !search && (
            <Command.Group heading="Recent" className="px-2 py-2">
              {recentStocksData.map((stock) => (
                <Command.Item
                  key={stock.symbol}
                  value={stock.symbol}
                  onSelect={() => handleSelect(stock.symbol)}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-3",
                    "text-sm outline-none transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-accent-foreground group-data-[selected=true]:text-accent-foreground transition-colors" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold">{stock.symbol}</span>
                      <span className="text-xs text-muted-foreground group-hover:text-accent-foreground/70 group-data-[selected=true]:text-accent-foreground/70 truncate transition-colors">{stock.name}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 font-semibold border-0 bg-muted/50 text-muted-foreground group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground group-data-[selected=true]:bg-accent-foreground/10 group-data-[selected=true]:text-accent-foreground transition-colors"
                  >
                    {stock.sector}
                  </Badge>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Popular Stocks */}
          {!search && (
            <Command.Group heading="Popular" className="px-2 py-2">
              {POPULAR_STOCKS.map((stock) => (
                <Command.Item
                  key={stock.symbol}
                  value={`${stock.symbol} ${stock.name}`}
                  onSelect={() => handleSelect(stock.symbol)}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-3",
                    "text-sm outline-none transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <TrendingUpIcon className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-accent-foreground group-data-[selected=true]:text-accent-foreground transition-colors" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold">{stock.symbol}</span>
                      <span className="text-xs text-muted-foreground group-hover:text-accent-foreground/70 group-data-[selected=true]:text-accent-foreground/70 truncate transition-colors">{stock.name}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 font-semibold border-0 bg-muted/50 text-muted-foreground group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground group-data-[selected=true]:bg-accent-foreground/10 group-data-[selected=true]:text-accent-foreground transition-colors"
                  >
                    {stock.sector}
                  </Badge>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Loading State */}
          {search && isSearching && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </div>
          )}

          {/* Search Results */}
          {search && !isSearching && searchResults.length > 0 && (
            <Command.Group heading={`Results (${searchResults.length})`} className="px-2 py-2">
              {searchResults.map((stock) => (
                <Command.Item
                  key={stock.symbol}
                  value={`${stock.symbol} ${stock.name}`}
                  onSelect={() => handleSelect(stock.symbol)}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-3",
                    "text-sm outline-none transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <SearchIcon className="h-4 w-4 text-primary shrink-0 group-hover:text-accent-foreground group-data-[selected=true]:text-accent-foreground transition-colors" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold">{stock.symbol}</span>
                      <span className="text-xs text-muted-foreground group-hover:text-accent-foreground/70 group-data-[selected=true]:text-accent-foreground/70 truncate transition-colors">{stock.name}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 font-semibold border-0 bg-muted/50 text-muted-foreground group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground group-data-[selected=true]:bg-accent-foreground/10 group-data-[selected=true]:text-accent-foreground transition-colors"
                  >
                    {stock.sector}
                  </Badge>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer */}
        <div className="border-t border-primary/10 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Press Enter to select</span>
            <div className="flex gap-2">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-primary/20 bg-primary/5 px-1.5 font-mono text-[10px] font-medium">
                ↑↓
              </kbd>
              <span>to navigate</span>
            </div>
          </div>
        </div>
      </Command>
    </>
  );
}
