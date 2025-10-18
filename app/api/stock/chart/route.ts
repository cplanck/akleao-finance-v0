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
    let interval: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "1d" = "1d";

    // Calculate date range and interval based on the range parameter
    // Use granular intervals for shorter periods to show maximum data points
    switch (range) {
      case "1D":
        from.setDate(from.getDate() - 2);
        interval = "5m"; // 5-minute intervals for intraday
        break;
      case "1W":
        from.setDate(from.getDate() - 10);
        interval = "15m"; // 15-minute intervals for 1 week
        break;
      case "1M":
        from.setDate(from.getDate() - 35);
        interval = "60m"; // Hourly intervals for 1 month
        break;
      case "3M":
        from.setDate(from.getDate() - 95);
        interval = "1d"; // Daily intervals for 3 months
        break;
      case "1Y":
        from.setDate(from.getDate() - 370);
        interval = "1d"; // Daily intervals for 1 year
        break;
      default:
        from.setDate(from.getDate() - 35);
        interval = "1d";
    }

    const result = await yahooFinance.chart(symbol, {
      period1: from,
      period2: today,
      interval: interval,
    });

    if (result.quotes && result.quotes.length > 0) {
      let quotes = result.quotes.filter((q: any) => q.close !== null);

      // Determine if this is an intraday interval (minutes/hours) or daily
      const isIntraday = interval.endsWith("m");

      // For very short intraday periods, limit to reasonable number of points
      if (interval === "5m") {
        quotes = quotes.slice(-78); // Last 78 points (full trading day)
      } else if (interval === "15m") {
        // 15-min intervals: ~26 points per day, keep last ~200 points for week view
        quotes = quotes.slice(-200);
      } else if (interval === "60m") {
        // Hourly: ~6.5 points per day, keep last ~150 points for month view
        quotes = quotes.slice(-150);
      }

      const data = quotes.map((q: any) => {
        const date = new Date(q.date);
        let formattedDate: string;

        if (interval === "5m") {
          // For 1 day view: just show time
          formattedDate = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else if (interval === "15m" || interval === "60m") {
          // For 1 week / 1 month views: show date + time for context
          formattedDate = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }) + " " + date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else {
          // For daily: show date only
          formattedDate = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        }

        return {
          date: formattedDate,
          price: q.close,
        };
      });

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
