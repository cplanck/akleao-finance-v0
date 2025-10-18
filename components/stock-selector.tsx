"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SP500_STOCKS, SECTOR_COLORS } from "@/lib/sp500-stocks";

interface StockSelectorProps {
  selectedStock: string;
  onSelectStock: (symbol: string) => void;
}

export default function StockSelector({
  selectedStock,
  onSelectStock,
}: StockSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedStockData = SP500_STOCKS.find(
    (stock) => stock.symbol === selectedStock
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-auto justify-between group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 bg-gradient-to-br from-card/50 to-card backdrop-blur-sm border-primary/10 hover:border-primary/30"
        >
          <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
            <Search className="h-4 w-4 text-primary shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            {selectedStockData ? (
              <>
                <span className="font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">{selectedStockData.symbol}</span>
                <span className="text-muted-foreground/50 hidden sm:inline">-</span>
                <span className="truncate hidden sm:inline text-muted-foreground font-medium">{selectedStockData.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground font-medium">Select stock...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-300 group-hover:opacity-100 group-hover:scale-110" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[500px] md:w-[600px] p-0 backdrop-blur-xl bg-card/95 border-primary/10 shadow-2xl" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search stocks..." className="border-b border-primary/10" />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No stock found.</CommandEmpty>
            <CommandGroup heading="All Stocks" className="p-2">
              {SP500_STOCKS.map((stock) => (
                <CommandItem
                  key={stock.symbol}
                  value={`${stock.symbol} ${stock.name}`}
                  onSelect={() => {
                    onSelectStock(stock.symbol);
                    setOpen(false);
                  }}
                  className="group px-3 py-2.5 cursor-pointer hover:bg-primary/10 rounded-lg transition-all duration-200 data-[selected=true]:bg-primary/5"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-primary transition-all duration-200",
                      selectedStock === stock.symbol
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-50"
                    )}
                  />
                  <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                      <span className="font-bold shrink-0 group-hover:text-primary transition-colors duration-200">{stock.symbol}</span>
                      <span className="text-muted-foreground/50 hidden sm:inline">-</span>
                      <span className="truncate text-sm text-muted-foreground font-medium">{stock.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs shrink-0 hidden md:inline-flex font-semibold border-0 shadow-sm",
                        SECTOR_COLORS[stock.sector] ||
                          "bg-gray-500/10 text-gray-500"
                      )}
                    >
                      {stock.sector}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
