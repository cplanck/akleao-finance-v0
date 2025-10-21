"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { fetchDailyData, fetchIntradayData } from "@/lib/stock-api";
import { PinButton } from "@/components/pin-button";

interface StockChartProps {
  symbol: string;
  quote?: {
    price: number;
    change: number;
    changePercent: number;
    marketSession?: "regular" | "pre" | "post";
  };
  overview?: {
    name: string;
    sector: string;
    industry: string;
  };
  quoteLoading?: boolean;
  overviewLoading?: boolean;
  isLiveUpdating?: boolean;
}

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
};

export default function StockChart({
  symbol,
  quote,
  overview,
  quoteLoading,
  overviewLoading,
  isLiveUpdating = false
}: StockChartProps) {
  const [timeRange, setTimeRange] = useState("1M");

  const { data, isLoading } = useQuery({
    queryKey: ["chart", symbol, timeRange],
    queryFn: () => {
      if (timeRange === "1D") {
        return fetchIntradayData(symbol);
      }
      const days = timeRange === "1W" ? 7 : timeRange === "1M" ? 30 : timeRange === "3M" ? 90 : 365;
      return fetchDailyData(symbol, days);
    },
  });

  // Calculate appropriate tick interval for X-axis based on data length
  // Also returns indices to show (excluding first and last)
  const getTicksToShow = () => {
    if (!data || data.length === 0) return [];

    const dataLength = data.length;
    let interval = Math.ceil(dataLength / 10);

    // For intraday (1D), show ~8-10 ticks
    if (timeRange === "1D") {
      interval = Math.ceil(dataLength / 10);
    }
    // For 1 week (15m intervals, ~200 points), show ~10 ticks
    else if (timeRange === "1W") {
      interval = Math.ceil(dataLength / 10);
    }
    // For 1 month (hourly, ~150 points), show ~10 ticks
    else if (timeRange === "1M") {
      interval = Math.ceil(dataLength / 10);
    }
    // For 3 months (daily, ~65 points), show ~10 ticks
    else if (timeRange === "3M") {
      interval = Math.ceil(dataLength / 10);
    }
    // For 1 year (daily, ~250 points), show ~12 ticks (monthly)
    else if (timeRange === "1Y") {
      interval = Math.ceil(dataLength / 12);
    }

    // Generate tick indices, excluding first (0) and last (dataLength - 1)
    const ticks = [];
    for (let i = interval; i < dataLength - 1; i += interval) {
      ticks.push(i);
    }
    return ticks;
  };

  // Calculate dynamic Y-axis domain for Robinhood-style chart
  const getDomain = () => {
    if (!data || data.length === 0) return [0, 100];

    const prices = data.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1; // 10% padding

    return [Math.floor(min - padding), Math.ceil(max + padding)];
  };

  return (
    <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-2xl hover:shadow-primary/5 transition-all duration-500 h-full flex flex-col">
      {/* Ambient gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <CardHeader className="pb-2 px-3 pt-3 relative z-10 min-h-[88px]">
        {/* Stock Info Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 h-full">
          <div className="space-y-0.5 h-[52px] flex flex-col justify-center">
            <CardTitle className="text-xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text h-7">
              {overviewLoading ? (
                <span className="inline-block h-7 w-32 bg-muted animate-pulse rounded"></span>
              ) : (
                overview?.name || symbol
              )}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-5">
              <span className="font-medium">{symbol}</span>
              <PinButton symbol={symbol} />
              {overviewLoading ? (
                <span className="inline-block h-5 w-20 bg-muted animate-pulse rounded-full"></span>
              ) : overview && (
                <>
                  <span className="opacity-50">•</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {overview.sector}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right group h-[52px] flex flex-col justify-center">
            <div className="text-2xl font-bold font-mono transition-transform duration-300 group-hover:scale-105 h-7 tabular-nums flex items-center gap-2 sm:justify-end flex-wrap">
              {quoteLoading ? (
                <span className="inline-block h-7 w-28 bg-muted animate-pulse rounded"></span>
              ) : (
                <>
                  {isLiveUpdating && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  )}
                  {`$${quote?.price.toFixed(2)}`}
                  {quote?.marketSession === "post" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                      After Hours
                    </span>
                  )}
                  {quote?.marketSession === "pre" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                      Pre-Market
                    </span>
                  )}
                </>
              )}
            </div>
            <div
              className={`text-sm flex items-center sm:justify-end gap-1 font-semibold font-mono transition-all duration-300 h-6 tabular-nums ${
                (quote?.change || 0) >= 0
                  ? "text-green-500 group-hover:text-green-400"
                  : "text-red-500 group-hover:text-red-400"
              }`}
            >
              {quoteLoading ? (
                <span className="inline-block h-6 w-24 bg-muted animate-pulse rounded-full"></span>
              ) : (
                <>
                  <span className="text-lg">{(quote?.change || 0) >= 0 ? "↗" : "↘"}</span>
                  <span className="px-2 py-0.5 rounded-full bg-current/10">
                    {quote?.change.toFixed(2)} ({quote?.changePercent.toFixed(2)}%)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-3 relative z-10 flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 mb-2">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <span className="text-sm text-muted-foreground font-medium">Loading chart data...</span>
              </div>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart data={data || []} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-price)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-price)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted/20"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              ticks={getTicksToShow().map(i => data?.[i]?.date).filter((d): d is string => d !== undefined)}
              tickFormatter={(value) => {
                // For 1D: show time as is (e.g., "10:30 AM")
                if (timeRange === "1D") {
                  return value;
                }
                // For 1W and 1M: value is "Oct 10 10:30 AM", show just "Oct 10"
                if (timeRange === "1W" || timeRange === "1M") {
                  return value.split(" ").slice(0, 2).join(" ");
                }
                // For 3M and 1Y: value is "Oct 10", show as is
                return value;
              }}
              className="text-xs text-muted-foreground font-mono"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              className="text-xs font-mono"
              domain={getDomain()}
              hide
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `$${Number(value).toFixed(2)}`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="var(--color-price)"
              fill="url(#fillPrice)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 6,
                style: { fill: "var(--color-price)", opacity: 0.8 },
              }}
            />
          </AreaChart>
        </ChartContainer>
          )}
        </div>

        {/* Time Range Tabs - Bottom */}
        <div className="flex justify-center mt-2">
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList className="grid grid-cols-5 bg-muted/50 backdrop-blur-sm p-0.5 rounded-xl border border-primary/5">
              <TabsTrigger
                value="1D"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                1D
              </TabsTrigger>
              <TabsTrigger
                value="1W"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                1W
              </TabsTrigger>
              <TabsTrigger
                value="1M"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                1M
              </TabsTrigger>
              <TabsTrigger
                value="3M"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                3M
              </TabsTrigger>
              <TabsTrigger
                value="1Y"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                1Y
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
