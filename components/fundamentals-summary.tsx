"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { fetchStockOverview, fetchStockQuote } from "@/lib/stock-api";

interface FundamentalsSummaryProps {
  symbol: string;
}

export default function FundamentalsSummary({ symbol }: FundamentalsSummaryProps) {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["overview", symbol],
    queryFn: () => fetchStockOverview(symbol),
  });

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => fetchStockQuote(symbol),
  });

  if (overviewLoading || quoteLoading || !overview || !quote) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted-foreground/20 rounded w-32 animate-pulse"></div>
              <div className="space-y-1">
                <div className="h-3 bg-muted-foreground/20 rounded w-full animate-pulse"></div>
                <div className="h-3 bg-muted-foreground/20 rounded w-3/4 animate-pulse"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate AI-style summary based on fundamentals
  const generateSummary = () => {
    const peRatio = parseFloat(overview.peRatio);
    const dividendYield = parseFloat(overview.dividendYield.replace('%', ''));
    const beta = parseFloat(overview.beta);
    const eps = parseFloat(overview.eps);
    const week52High = parseFloat(overview.week52High.replace('$', ''));
    const week52Low = parseFloat(overview.week52Low.replace('$', ''));
    const currentPrice = quote.price;

    // Score each dimension
    let valuationScore = 0; // -1 (expensive), 0 (fair), 1 (cheap)
    if (!isNaN(peRatio) && peRatio > 0) {
      if (peRatio < 15) valuationScore = 1;
      else if (peRatio > 30) valuationScore = -1;
    }

    let profitabilityScore = 0; // -1 (unprofitable), 0 (modest), 1 (strong)
    if (!isNaN(eps)) {
      if (eps < 0) profitabilityScore = -1;
      else if (eps > 5) profitabilityScore = 1;
    }

    let dividendScore = 0; // 0 (none/low), 1 (attractive)
    if (!isNaN(dividendYield) && dividendYield > 2) dividendScore = 1;

    let stabilityScore = 0; // -1 (volatile), 0 (normal), 1 (stable)
    if (!isNaN(beta)) {
      if (beta > 1.5) stabilityScore = -1;
      else if (beta < 0.8) stabilityScore = 1;
    }

    let pricePositionScore = 0; // -1 (near high), 0 (mid), 1 (near low - potential value)
    let priceContext = "";
    if (!isNaN(week52High) && !isNaN(week52Low) && week52High > week52Low) {
      const rangePosition = ((currentPrice - week52Low) / (week52High - week52Low)) * 100;
      if (rangePosition > 85) {
        pricePositionScore = -1;
        priceContext = "near its yearly high";
      } else if (rangePosition < 15) {
        pricePositionScore = 1;
        priceContext = "near its yearly low";
      } else if (rangePosition > 60) {
        priceContext = "trading in the upper range";
      } else if (rangePosition < 40) {
        priceContext = "trading in the lower range";
      } else {
        priceContext = "mid-range";
      }
    }

    // Calculate overall assessment
    const totalScore = valuationScore + profitabilityScore + dividendScore + stabilityScore + pricePositionScore;

    // Generate contextual takeaway
    let takeaway = "";

    // Strong value opportunity (score >= 2)
    if (totalScore >= 2) {
      if (profitabilityScore === 1 && valuationScore === 1) {
        takeaway = `appears to be a strong value opportunity—profitable with attractive valuation (P/E ${peRatio.toFixed(1)}) and trading ${priceContext}`;
      } else if (dividendScore === 1 && profitabilityScore >= 0) {
        takeaway = `presents a solid income opportunity with ${dividendYield.toFixed(2)}% dividend yield, ${eps > 0 ? 'profitable earnings' : 'building earnings'}, and ${priceContext}`;
      } else {
        takeaway = `shows promising fundamentals for value investors—${priceContext} with ${eps > 0 ? 'positive earnings' : 'growth potential'}`;
      }
    }
    // Neutral/Mixed signals (score 0-1)
    else if (totalScore >= 0) {
      if (profitabilityScore === 1) {
        takeaway = `demonstrates strong profitability ($${eps.toFixed(2)} EPS) but ${valuationScore === -1 ? 'trades at premium valuation' : 'has mixed valuation signals'}, currently ${priceContext}`;
      } else if (valuationScore === 1 && profitabilityScore === 0) {
        takeaway = `offers reasonable valuation (P/E ${peRatio.toFixed(1)}) with modest earnings, ${priceContext}—potential for patient investors`;
      } else {
        takeaway = `presents a balanced profile with ${eps > 0 ? 'profitable operations' : 'developing earnings'} and ${priceContext}, suitable for moderate risk tolerance`;
      }
    }
    // Caution signals (score < 0)
    else {
      if (profitabilityScore === -1 && valuationScore === -1) {
        takeaway = `requires caution—currently unprofitable with elevated valuation and ${priceContext}, better suited for growth-focused investors`;
      } else if (pricePositionScore === -1 && valuationScore === -1) {
        takeaway = `trading near yearly highs with premium valuation (P/E ${peRatio.toFixed(1)})—value investors may want to wait for a better entry point`;
      } else if (stabilityScore === -1) {
        takeaway = `exhibits high volatility (β ${beta.toFixed(2)}) and ${priceContext}, presenting higher risk but potential for aggressive investors`;
      } else {
        takeaway = `shows mixed signals—${eps < 0 ? 'not yet profitable' : 'modest earnings'} with ${priceContext}, requiring careful consideration`;
      }
    }

    return takeaway;
  };

  const summary = generateSummary();
  const eps = parseFloat(overview.eps);
  const peRatio = parseFloat(overview.peRatio);
  const isPositive = peRatio > 0 && peRatio < 25 && eps > 0;

  return (
    <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-muted">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10 shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Value Investor Insights</h3>
              <Badge variant="outline" className="text-xs">
                {isPositive ? (
                  <>
                    <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                    <span className="text-green-500">Positive</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 mr-1 text-amber-500" />
                    <span className="text-amber-500">Caution</span>
                  </>
                )}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {summary ? (
                <>
                  <span className="font-medium text-foreground">{overview.name}</span> shows {summary}.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{overview.name}</span> - fundamentals data is being analyzed.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
