"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { fetchDailyData, fetchIntradayData } from "@/lib/stock-api";

interface StockChartProps {
  symbol: string;
}

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
};

export default function StockChart({ symbol }: StockChartProps) {
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg sm:text-xl">Price Chart</CardTitle>
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList className="grid grid-cols-5 w-full sm:w-auto">
              <TabsTrigger value="1D" className="text-xs sm:text-sm">1D</TabsTrigger>
              <TabsTrigger value="1W" className="text-xs sm:text-sm">1W</TabsTrigger>
              <TabsTrigger value="1M" className="text-xs sm:text-sm">1M</TabsTrigger>
              <TabsTrigger value="3M" className="text-xs sm:text-sm">3M</TabsTrigger>
              <TabsTrigger value="1Y" className="text-xs sm:text-sm">1Y</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] sm:h-[400px] md:h-[500px] flex items-center justify-center text-muted-foreground">
            Loading chart data...
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] sm:h-[400px] md:h-[500px] w-full">
            <AreaChart data={data || []} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
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
              ticks={getTicksToShow().map(i => data[i].date)}
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
              className="text-xs text-muted-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              className="text-xs"
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
      </CardContent>
    </Card>
  );
}
