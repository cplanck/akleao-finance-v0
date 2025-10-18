import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new YahooFinanceClass({
  suppressNotices: ['yahooSurvey']
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const range = searchParams.get("range") || "1d";

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    const today = new Date();
    const from = new Date();
    let interval: "5m" | "1d" = "1d";

    // Calculate date range and interval based on the range parameter
    switch (range) {
      case "1D":
        from.setDate(from.getDate() - 2);
        interval = "5m";
        break;
      case "1W":
        from.setDate(from.getDate() - 7);
        interval = "1d";
        break;
      case "1M":
        from.setDate(from.getDate() - 30);
        interval = "1d";
        break;
      case "3M":
        from.setDate(from.getDate() - 90);
        interval = "1d";
        break;
      case "1Y":
        from.setDate(from.getDate() - 365);
        interval = "1d";
        break;
      default:
        from.setDate(from.getDate() - 30);
        interval = "1d";
    }

    const result = await yahooFinance.chart(symbol, {
      period1: from,
      period2: today,
      interval: interval,
    });

    if (result.quotes && result.quotes.length > 0) {
      let quotes = result.quotes.filter((q: any) => q.close !== null);

      // For intraday, limit to last 78 data points
      if (interval === "5m") {
        quotes = quotes.slice(-78);
      }

      const data = quotes.map((q: any) => ({
        date:
          interval === "5m"
            ? new Date(q.date).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date(q.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
        price: q.close,
      }));

      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "No data available" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}
