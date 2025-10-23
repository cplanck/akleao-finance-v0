"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { fetchDailyData, fetchIntradayData } from "@/lib/stock-api";
import { PinButton } from "@/components/pin-button";
import { usePolygonWebSocket } from "@/hooks/use-polygon-websocket";

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveChartData, setLiveChartData] = useState<{ date: string; price: number }[]>([]);
  const liveDataBufferRef = useRef<{ date: string; price: number }[]>([]);
  const maxLivePoints = 60; // Keep last 60 trades

  // WebSocket for LIVE mode with throttling
  const lastChartUpdateRef = useRef<number>(0);
  const pendingTradeRef = useRef<{ price: number; timestamp: number } | null>(null);
  const chartUpdateThrottleMs = 1000; // Update chart once per second
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isConnected, latestTrade } = usePolygonWebSocket({
    symbol,
    enabled: false, // Disabled: Polygon WebSocket requires paid subscription
    onTrade: (trade) => {
      // Store the latest trade without triggering re-renders
      pendingTradeRef.current = trade;
    },
  });

  // Batch chart updates using an interval
  useEffect(() => {
    if (timeRange !== "LIVE") {
      return;
    }

    const updateInterval = setInterval(() => {
      const trade = pendingTradeRef.current;
      if (!trade) return; // No new trade data

      const timestamp = new Date(trade.timestamp);
      const timeString = timestamp.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const newDataPoint = {
        date: timeString,
        price: trade.price,
      };

      // Update buffer and state
      const newBuffer = [...liveDataBufferRef.current, newDataPoint].slice(-maxLivePoints);
      liveDataBufferRef.current = newBuffer;
      setLiveChartData(newBuffer);

      // Brief animation flash
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      setIsRefreshing(true);
      animationTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 300);

      // Clear pending trade
      pendingTradeRef.current = null;
    }, chartUpdateThrottleMs);

    return () => {
      clearInterval(updateInterval);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [timeRange]);

  // Query for historical data and LIVE polling (fallback when WebSocket not connected)
  const { data: historicalData, isLoading } = useQuery({
    queryKey: ["chart", symbol, timeRange],
    queryFn: () => {
      if (timeRange === "1D" || timeRange === "LIVE") {
        return fetchIntradayData(symbol, timeRange);
      }
      const days = timeRange === "1W" ? 7 : timeRange === "1M" ? 30 : timeRange === "1Y" ? 365 : timeRange === "All" ? 1825 : 365;
      return fetchDailyData(symbol, days);
    },
    // Only poll when in LIVE mode and WebSocket is NOT connected (fallback)
    refetchInterval: timeRange === "LIVE" && !isConnected ? 2000 : false,
  });

  // Initialize live chart data when switching to LIVE mode
  useEffect(() => {
    if (timeRange === "LIVE" && historicalData && !isConnected) {
      // Use historical data as initial data
      const initialData = historicalData.slice(-maxLivePoints);
      liveDataBufferRef.current = initialData;
      setLiveChartData(initialData);
    } else if (timeRange === "LIVE" && isConnected && liveDataBufferRef.current.length === 0) {
      // Initialize with empty if WebSocket connected but no data yet
      setLiveChartData([]);
    } else if (timeRange !== "LIVE") {
      // Clear live data when switching away from LIVE
      liveDataBufferRef.current = [];
      setLiveChartData([]);
    }
  }, [timeRange, historicalData, isConnected]);

  // Determine which data to use
  const data = timeRange === "LIVE" && isConnected ? liveChartData : historicalData;

  // Calculate appropriate tick interval for X-axis based on data length
  // Also returns indices to show (excluding first and last)
  const getTicksToShow = () => {
    if (!data || data.length === 0) return [];

    const dataLength = data.length;
    let interval = Math.ceil(dataLength / 10);

    // For live (1m intervals, ~60 points), show ~6 ticks
    if (timeRange === "LIVE") {
      interval = Math.ceil(dataLength / 6);
    }
    // For intraday (1D), show ~8-10 ticks
    else if (timeRange === "1D") {
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
    // For 1 year (daily, ~250 points), show ~12 ticks (monthly)
    else if (timeRange === "1Y") {
      interval = Math.ceil(dataLength / 12);
    }
    // For All (5 years, daily, ~1250 points), show ~12 ticks (yearly)
    else if (timeRange === "All") {
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
            <AreaChart data={data || []} margin={{ left: 0, right: timeRange === "LIVE" ? 7 : 0, top: 5, bottom: 0 }}>
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
                // For LIVE and 1D: show time as is (e.g., "10:30 AM")
                if (timeRange === "LIVE" || timeRange === "1D") {
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
              cursor={{ strokeDasharray: "3 3" }}
              offset={50}
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
              animationDuration={timeRange === "LIVE" ? 200 : 800}
              dot={(props: any) => {
                // Show dot at the very end in LIVE mode
                const dotIndex = (data?.length || 0) - 1;
                if (timeRange === "LIVE" && props.index === dotIndex && dotIndex >= 0) {
                  return (
                    <g>
                      {/* Ping animation ring - only when refreshing, rendered behind */}
                      {isRefreshing && (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={8}
                          fill="var(--color-price)"
                          className="animate-ping"
                          opacity={0.5}
                        />
                      )}
                      {/* Pulsing outer glow ring - pulses when refreshing */}
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isRefreshing ? 9 : 7}
                        fill="var(--color-price)"
                        opacity={isRefreshing ? 0.5 : 0.3}
                        style={{
                          transition: 'all 0.2s ease-out',
                          filter: isRefreshing ? 'blur(2px)' : 'blur(1px)',
                        }}
                      />
                      {/* Main dot - completely static, always on top, never changes */}
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="var(--color-price)"
                        opacity={1}
                        style={{
                          pointerEvents: 'none',
                        }}
                      />
                    </g>
                  );
                }
                return <g />;
              }}
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
            <TabsList className="grid grid-cols-6 bg-muted/50 backdrop-blur-sm p-0.5 rounded-xl border border-primary/5">
              <TabsTrigger
                value="LIVE"
                className="text-xs px-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 flex items-center gap-1"
              >
                <span className={timeRange === "LIVE" ? "relative flex h-2 w-2" : "hidden"}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Live
              </TabsTrigger>
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
                value="1Y"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                1Y
              </TabsTrigger>
              <TabsTrigger
                value="All"
                className="text-xs px-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
              >
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
