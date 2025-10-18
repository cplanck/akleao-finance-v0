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
      return NextResponse.json({
        symbol: quote.symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        volume: quote.regularMarketVolume || 0,
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
