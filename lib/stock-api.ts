// Stock API client - calls our Next.js API routes
// Data sourced from Yahoo Finance (completely free!)

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  marketSession?: "regular" | "pre" | "post";
  regularMarket?: {
    price: number;
    change: number;
    changePercent: number;
  };
  postMarket?: {
    price: number;
    change: number;
    changePercent: number;
  };
  preMarket?: {
    price: number;
    change: number;
    changePercent: number;
  };
}

export interface StockOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  peRatio: string;
  dividendYield: string;
  eps: string;
  beta: string;
  week52High: string;
  week52Low: string;
  employees: string;
}

export interface ChartDataPoint {
  date: string;
  price: number;
}

// Fetch real-time quote
export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  try {
    const response = await fetch(`/api/stock/quote?symbol=${symbol}`);

    if (!response.ok) {
      throw new Error("Failed to fetch quote");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching stock quote:", error);
    // Return mock data as fallback
    const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const basePrice = 100 + (seed % 300);
    const change = ((seed % 20) - 10) / 10;
    return {
      symbol,
      price: basePrice + change,
      change: change,
      changePercent: (change / basePrice) * 100,
      high: basePrice + Math.abs(change) + 2,
      low: basePrice - Math.abs(change) - 1,
      volume: 10000000 + (seed % 50000000),
    };
  }
}

// Fetch company overview
export async function fetchStockOverview(symbol: string): Promise<StockOverview> {
  try {
    const response = await fetch(`/api/stock/overview?symbol=${symbol}`);

    if (!response.ok) {
      throw new Error("Failed to fetch overview");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching stock overview:", error);
    // Return mock data as fallback
    const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const marketCapBillions = 10 + (seed % 500);
    const marketCap = marketCapBillions >= 1000
      ? `$${(marketCapBillions / 1000).toFixed(1)}T`
      : `$${marketCapBillions.toFixed(0)}B`;

    const peRatio = (10 + (seed % 40)).toFixed(1);
    const dividendYield = ((seed % 40) / 10).toFixed(2);
    const eps = ((seed % 20) + 0.5).toFixed(2);
    const beta = (0.5 + (seed % 20) / 10).toFixed(2);
    const basePrice = 50 + (seed % 450);
    const high = (basePrice * (1.05 + (seed % 20) / 100)).toFixed(2);
    const low = (basePrice * (0.85 + (seed % 10) / 100)).toFixed(2);

    return {
      symbol,
      name: `${symbol} Corporation`,
      description: `${symbol} is a leading company in its sector, providing innovative products and services to customers worldwide.`,
      sector: ["Technology", "Healthcare", "Finance", "Energy", "Consumer"][seed % 5],
      industry: "Various Industries",
      marketCap,
      peRatio,
      dividendYield: dividendYield === "0.00" ? "N/A" : `${dividendYield}%`,
      eps: `$${eps}`,
      beta,
      week52High: `$${high}`,
      week52Low: `$${low}`,
      employees: `${((seed % 450) + 10).toLocaleString()}000`,
    };
  }
}

// Fetch intraday chart data (1 day, 5-minute intervals)
export async function fetchIntradayData(symbol: string, range: string = "1D"): Promise<ChartDataPoint[]> {
  try {
    const response = await fetch(`/api/stock/chart?symbol=${symbol}&range=${range}`);

    if (!response.ok) {
      throw new Error("Failed to fetch chart data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching intraday data:", error);
    return generateMockData(range === "LIVE" ? 60 : 78, symbol);
  }
}

// Fetch daily chart data
export async function fetchDailyData(
  symbol: string,
  days: number = 30
): Promise<ChartDataPoint[]> {
  try {
    let range = "1M";
    if (days <= 7) range = "1W";
    else if (days <= 30) range = "1M";
    else if (days <= 90) range = "3M";
    else range = "1Y";

    const response = await fetch(`/api/stock/chart?symbol=${symbol}&range=${range}`);

    if (!response.ok) {
      throw new Error("Failed to fetch chart data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching daily data:", error);
    return generateMockData(days, symbol);
  }
}

// Mock data generator for fallback (deterministic to avoid hydration errors)
function generateMockData(points: number, symbol: string): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const basePrice = 100 + (seed % 300);

  for (let i = 0; i < points; i++) {
    // Use deterministic "random" based on seed and index to avoid hydration mismatch
    const pseudoRandom = ((seed + i) * 9301 + 49297) % 233280 / 233280;
    const variance = (pseudoRandom * 40) - 20;
    const trend = (i / points) * 8;
    data.push({
      date: `Point ${i + 1}`,
      price: basePrice + variance + trend,
    });
  }

  return data;
}
