"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStockOverview, fetchStockQuote } from "@/lib/stock-api";
import MetricCardWithAI from "./metric-card-with-ai";

interface KeyMetricsProps {
  symbol: string;
}

interface Metric {
  label: string;
  value: string;
  description: string;
}

export default function KeyMetrics({ symbol }: KeyMetricsProps) {
  const { data: overview } = useQuery({
    queryKey: ["overview", symbol],
    queryFn: () => fetchStockOverview(symbol),
  });

  const { data: quote } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => fetchStockQuote(symbol),
  });

  if (!overview || !quote) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Loading...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">...</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const metrics: Metric[] = [
    {
      label: "Company Size",
      value: overview.marketCap,
      description: "How big the company is worth",
    },
    {
      label: "Price vs Profit",
      value: overview.peRatio,
      description: "Is the stock expensive or cheap?",
    },
    {
      label: "Dividend Payout",
      value: overview.dividendYield,
      description: "Cash paid to shareholders yearly",
    },
    {
      label: "Trading Activity",
      value: (quote.volume / 1000000).toFixed(1) + "M",
      description: "How many people bought/sold today",
    },
    {
      label: "Year High",
      value: overview.week52High,
      description: "Peak price in the last 12 months",
    },
    {
      label: "Year Low",
      value: overview.week52Low,
      description: "Lowest price in the last 12 months",
    },
    {
      label: "Profit Per Share",
      value: overview.eps,
      description: "How much money each share makes",
    },
    {
      label: "Price Stability",
      value: overview.beta,
      description: "How wild the price swings are",
    },
  ];

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">What You Need to Know</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((metric) => (
          <MetricCardWithAI
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            context={`Stock: ${symbol}`}
          />
        ))}
      </div>
    </div>
  );
}
