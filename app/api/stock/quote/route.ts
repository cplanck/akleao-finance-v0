import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new YahooFinanceClass({
  suppressNotices: ['yahooSurvey']
});

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

    const quote = await yahooFinance.quote(symbol);

    if (quote) {
      // Determine which price to use based on market status
      // Priority: post-market (after hours) > pre-market > regular market
      const hasPostMarket = quote.postMarketPrice !== undefined && quote.postMarketPrice !== null;
      const hasPreMarket = quote.preMarketPrice !== undefined && quote.preMarketPrice !== null;

      let currentPrice = quote.regularMarketPrice || 0;
      let currentChange = quote.regularMarketChange || 0;
      let currentChangePercent = quote.regularMarketChangePercent || 0;
      let marketSession = "regular";

      if (hasPostMarket) {
        currentPrice = quote.postMarketPrice;
        currentChange = quote.postMarketChange || 0;
        currentChangePercent = quote.postMarketChangePercent || 0;
        marketSession = "post";
      } else if (hasPreMarket) {
        currentPrice = quote.preMarketPrice;
        currentChange = quote.preMarketChange || 0;
        currentChangePercent = quote.preMarketChangePercent || 0;
        marketSession = "pre";
      }

      return NextResponse.json({
        symbol: quote.symbol,
        price: currentPrice,
        change: currentChange,
        changePercent: currentChangePercent,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        volume: quote.regularMarketVolume || 0,
        marketSession,
        // Include all session data for reference
        regularMarket: {
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
        },
        postMarket: hasPostMarket ? {
          price: quote.postMarketPrice,
          change: quote.postMarketChange || 0,
          changePercent: quote.postMarketChangePercent || 0,
        } : undefined,
        preMarket: hasPreMarket ? {
          price: quote.preMarketPrice,
          change: quote.preMarketChange || 0,
          changePercent: quote.preMarketChangePercent || 0,
        } : undefined,
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error fetching stock quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
