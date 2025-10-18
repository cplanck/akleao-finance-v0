"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardContent className="pt-6">
        <div>
          {/* Search Dropdown */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Search Stocks
            </label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selectedStockData ? (
                      <>
                        <span className="font-semibold">{selectedStockData.symbol}</span>
                        <span className="text-muted-foreground hidden sm:inline">-</span>
                        <span className="truncate hidden sm:inline">{selectedStockData.name}</span>
                      </>
                    ) : (
                      "Select stock..."
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[500px] md:w-[600px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search stocks..." />
                  <CommandList>
                    <CommandEmpty>No stock found.</CommandEmpty>
                    <CommandGroup heading="All Stocks">
                      {SP500_STOCKS.map((stock) => (
                        <CommandItem
                          key={stock.symbol}
                          value={`${stock.symbol} ${stock.name}`}
                          onSelect={() => {
                            onSelectStock(stock.symbol);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selectedStock === stock.symbol
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
                            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                              <span className="font-semibold shrink-0">{stock.symbol}</span>
                              <span className="text-muted-foreground hidden sm:inline">-</span>
                              <span className="truncate text-sm">{stock.name}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs shrink-0 hidden md:inline-flex",
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
