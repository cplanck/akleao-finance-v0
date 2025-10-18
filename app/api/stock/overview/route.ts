import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new YahooFinanceClass({
  suppressNotices: ['yahooSurvey']
});

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    const quote = await yahooFinance.quoteSummary(symbol, {
      modules: ["summaryDetail", "price", "defaultKeyStatistics", "assetProfile"],
    });

    const summaryDetail = quote.summaryDetail;
    const price = quote.price;
    const keyStats = quote.defaultKeyStatistics;
    const profile = quote.assetProfile;

    return NextResponse.json({
      symbol: price?.symbol || symbol,
      name: price?.longName || price?.shortName || symbol,
      description: profile?.longBusinessSummary || "No description available",
      sector: profile?.sector || "N/A",
      industry: profile?.industry || "N/A",
      marketCap: price?.marketCap ? formatMarketCap(price.marketCap) : "N/A",
      peRatio: summaryDetail?.trailingPE
        ? summaryDetail.trailingPE.toFixed(2)
        : "N/A",
      dividendYield: summaryDetail?.dividendYield
        ? `${(summaryDetail.dividendYield * 100).toFixed(2)}%`
        : "N/A",
      eps: keyStats?.trailingEps ? `$${keyStats.trailingEps.toFixed(2)}` : "N/A",
      beta: keyStats?.beta ? keyStats.beta.toFixed(2) : "N/A",
      week52High: summaryDetail?.fiftyTwoWeekHigh
        ? `$${summaryDetail.fiftyTwoWeekHigh.toFixed(2)}`
        : "N/A",
      week52Low: summaryDetail?.fiftyTwoWeekLow
        ? `$${summaryDetail.fiftyTwoWeekLow.toFixed(2)}`
        : "N/A",
      employees: profile?.fullTimeEmployees
        ? profile.fullTimeEmployees.toLocaleString()
        : "N/A",
    });
  } catch (error) {
    console.error("Error fetching stock overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    );
  }
}
