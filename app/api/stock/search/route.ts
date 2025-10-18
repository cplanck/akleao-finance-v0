import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    // Use Yahoo Finance autocomplete API directly
    const response = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter and format results to only include stocks
    const stocks = (data.quotes || [])
      .filter((quote: any) =>
        quote.quoteType === "EQUITY" &&
        quote.symbol &&
        !quote.symbol.includes("^") && // Exclude indices
        !quote.symbol.includes("=") // Exclude forex
      )
      .map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.longname || quote.shortname || quote.symbol,
        sector: quote.sector || "N/A",
        exchange: quote.exchange || quote.exchDisp || "N/A",
      }))
      .slice(0, 15); // Limit to 15 results

    return NextResponse.json({ results: stocks });
  } catch (error) {
    console.error("Error searching stocks:", error);
    return NextResponse.json(
      { error: "Failed to search stocks", results: [] },
      { status: 500 }
    );
  }
}
