"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Position {
  id: number;
  stock_symbol: string;
  shares: number;
  entry_price: number;
  entry_date: string;
  exit_date: string | null;
  is_active: boolean;
}

interface ChartDataPoint {
  date: string;
  stockValue: number;
  spyValue: number;
  stockReturn: number;
  spyReturn: number;
  alpha: number;
}

export function PositionPerformanceChart({
  position,
  onDataUpdate
}: {
  position: Position;
  onDataUpdate?: (data: ChartDataPoint[]) => void;
}) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerformanceData() {
      try {
        setIsLoading(true);

        // Calculate date range
        const entryDate = new Date(position.entry_date);
        const exitDate = position.exit_date ? new Date(position.exit_date) : new Date();
        const daysDiff = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

        // Determine appropriate range parameter
        let range = "1Y";
        if (daysDiff <= 7) range = "1W";
        else if (daysDiff <= 30) range = "1M";
        else if (daysDiff <= 90) range = "3M";

        // Fetch stock and SPY data in parallel
        const [stockResponse, spyResponse] = await Promise.all([
          fetch(`/api/stock/chart?symbol=${position.stock_symbol}&range=${range}`),
          fetch(`/api/stock/chart?symbol=SPY&range=${range}`)
        ]);

        if (!stockResponse.ok || !spyResponse.ok) {
          throw new Error("Failed to fetch chart data");
        }

        const stockData = await stockResponse.json();
        const spyData = await spyResponse.json();

        // Filter data to start from entry date
        const entryDateStr = entryDate.toISOString().split('T')[0];

        // Find the entry prices
        let stockEntryPrice = position.entry_price;
        let spyEntryPrice = 0;

        // Find SPY price closest to entry date
        for (let i = 0; i < spyData.length; i++) {
          const dataDate = new Date(spyData[i].date);
          if (dataDate >= entryDate) {
            spyEntryPrice = spyData[i].price;
            break;
          }
        }

        // If we couldn't find entry price, use first available
        if (spyEntryPrice === 0 && spyData.length > 0) {
          spyEntryPrice = spyData[0].price;
        }

        // Calculate initial investment value
        const initialValue = position.shares * stockEntryPrice;
        const spyShares = initialValue / spyEntryPrice;

        // Build chart data by matching dates
        const chartPoints: ChartDataPoint[] = [];

        stockData.forEach((stockPoint: any) => {
          // Find corresponding SPY data point (match by date or closest)
          const spyPoint = spyData.find((spy: any) => spy.date === stockPoint.date);

          if (spyPoint) {
            const stockValue = position.shares * stockPoint.price;
            const spyValue = spyShares * spyPoint.price;
            const stockReturn = ((stockPoint.price - stockEntryPrice) / stockEntryPrice) * 100;
            const spyReturn = ((spyPoint.price - spyEntryPrice) / spyEntryPrice) * 100;
            const alpha = stockReturn - spyReturn;

            chartPoints.push({
              date: stockPoint.date,
              stockValue: Math.round(stockValue * 100) / 100,
              spyValue: Math.round(spyValue * 100) / 100,
              stockReturn: Math.round(stockReturn * 100) / 100,
              spyReturn: Math.round(spyReturn * 100) / 100,
              alpha: Math.round(alpha * 100) / 100,
            });
          }
        });

        setChartData(chartPoints);
        setError(null);

        // Notify parent component of data update
        if (onDataUpdate) {
          onDataUpdate(chartPoints);
        }
      } catch (err) {
        console.error("Error fetching performance data:", err);
        setError("Failed to load performance data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPerformanceData();
  }, [position, onDataUpdate]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance vs SPY</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance vs SPY</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            {error || "No performance data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestData = chartData[chartData.length - 1];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Performance vs SPY</CardTitle>
          <div className="flex gap-4 text-xs">
            <div className="text-right">
              <div className="text-muted-foreground">Stock Return</div>
              <div className={`font-bold ${latestData.stockReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                {latestData.stockReturn >= 0 ? "+" : ""}{latestData.stockReturn.toFixed(2)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Alpha</div>
              <div className={`font-bold ${latestData.alpha >= 0 ? "text-green-500" : "text-red-500"}`}>
                {latestData.alpha >= 0 ? "+" : ""}{latestData.alpha.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: any, name: string) => {
                if (name === "stockValue" || name === "spyValue") {
                  return [`$${value.toLocaleString()}`, name === "stockValue" ? position.stock_symbol : "SPY"];
                }
                return [`${value}%`, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              formatter={(value) => {
                if (value === "stockValue") return position.stock_symbol;
                if (value === "spyValue") return "SPY";
                return value;
              }}
            />
            <Line
              type="monotone"
              dataKey="stockValue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="stockValue"
            />
            <Line
              type="monotone"
              dataKey="spyValue"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
              name="spyValue"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
