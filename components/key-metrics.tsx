"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStockOverview, fetchStockQuote } from "@/lib/stock-api";

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

  // Helper function to format market cap in human readable form
  const formatMarketCap = (marketCapStr: string): { short: string; long: string; raw: number } => {
    const marketCap = parseFloat(marketCapStr);
    let short = "";
    let long = "";

    if (marketCap >= 1e12) {
      short = `$${(marketCap / 1e12).toFixed(2)}T`;
      long = `${(marketCap / 1e12).toFixed(2)} trillion dollars`;
    } else if (marketCap >= 1e9) {
      short = `$${(marketCap / 1e9).toFixed(1)}B`;
      long = `${(marketCap / 1e9).toFixed(1)} billion dollars`;
    } else if (marketCap >= 1e6) {
      short = `$${(marketCap / 1e6).toFixed(1)}M`;
      long = `${(marketCap / 1e6).toFixed(1)} million dollars`;
    } else {
      short = marketCapStr;
      long = `${marketCapStr} dollars`;
    }

    return { short, long, raw: marketCap };
  };

  const marketCapFormatted = formatMarketCap(overview.marketCap);
  const currentPrice = quote.price;

  // Get company name from overview (Alpha Vantage provides this)
  const companyName = overview.name || symbol;

  // Calculate earnings per share value
  const eps = parseFloat(overview.eps.replace('$', ''));
  const epsDescription = eps >= 0
    ? `${companyName} earned $${Math.abs(eps).toFixed(2)} per share last year`
    : `${companyName} lost $${Math.abs(eps).toFixed(2)} per share last year`;

  // Calculate dividend in dollars per share
  const dividendYield = parseFloat(overview.dividendYield.replace('%', ''));
  const annualDividend = dividendYield > 0 ? ((dividendYield / 100) * currentPrice) : 0;
  const dividendDescription = annualDividend > 0
    ? `${companyName} pays $${annualDividend.toFixed(2)} per share each year`
    : `${companyName} doesn't pay dividends`;

  // Calculate distance from year high/low
  const yearHigh = parseFloat(overview.week52High.replace('$', ''));
  const yearLow = parseFloat(overview.week52Low.replace('$', ''));
  const distanceFromHigh = ((yearHigh - currentPrice) / yearHigh * 100).toFixed(1);
  const distanceFromLow = ((currentPrice - yearLow) / yearLow * 100).toFixed(1);

  // Beta interpretation
  const beta = parseFloat(overview.beta);
  const betaDesc = beta > 1.2
    ? `${companyName}'s price swings more wildly than the market`
    : beta < 0.8
    ? `${companyName}'s price is steadier than the market`
    : `${companyName}'s price moves with the market`;

  // P/E Ratio description
  const peRatio = parseFloat(overview.peRatio);
  const peDescription = peRatio > 0
    ? `Investors pay $${peRatio.toFixed(1)} for every $1 of earnings`
    : "Company isn't profitable yet";

  const metrics: Metric[] = [
    {
      label: "Company Size",
      value: marketCapFormatted.short,
      description: `${companyName} is worth ${marketCapFormatted.long}`,
    },
    {
      label: "Price vs Profit",
      value: overview.peRatio,
      description: peDescription,
    },
    {
      label: "Dividend Payout",
      value: overview.dividendYield,
      description: dividendDescription,
    },
    {
      label: "Trading Activity",
      value: (quote.volume / 1000000).toFixed(1) + "M",
      description: `There were ${(quote.volume / 1000000).toFixed(1)} million shares traded today`,
    },
    {
      label: "Year High",
      value: overview.week52High,
      description: `Currently ${distanceFromHigh}% below the year's peak price`,
    },
    {
      label: "Year Low",
      value: overview.week52Low,
      description: `Currently ${distanceFromLow}% above the year's lowest price`,
    },
    {
      label: "Profit Per Share",
      value: overview.eps,
      description: epsDescription,
    },
    {
      label: "Price Stability",
      value: overview.beta,
      description: betaDesc,
    },
  ];

  return (
    <div>
      <h2 className="text-base sm:text-lg font-semibold mb-2">What You Need to Know</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-1.5">
                <div className="text-lg sm:text-xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground line-clamp-2">{metric.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
