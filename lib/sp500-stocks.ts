// S&P 500 stocks with sector information
// This is a curated list of major S&P 500 stocks available in Alpha Vantage

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
}

export const SP500_STOCKS: Stock[] = [
  // Technology
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A", sector: "Technology" },
  { symbol: "GOOG", name: "Alphabet Inc. Class C", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { symbol: "RKLB", name: "Rocket Lab USA Inc.", sector: "Industrials" },
  { symbol: "ASTS", name: "AST SpaceMobile Inc.", sector: "Technology" },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Technology" },
  { symbol: "ORCL", name: "Oracle Corporation", sector: "Technology" },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { symbol: "CSCO", name: "Cisco Systems Inc.", sector: "Technology" },
  { symbol: "INTC", name: "Intel Corporation", sector: "Technology" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology" },
  { symbol: "IBM", name: "IBM", sector: "Technology" },
  { symbol: "QCOM", name: "Qualcomm Inc.", sector: "Technology" },
  { symbol: "TXN", name: "Texas Instruments", sector: "Technology" },
  { symbol: "NOW", name: "ServiceNow Inc.", sector: "Technology" },
  { symbol: "INTU", name: "Intuit Inc.", sector: "Technology" },
  { symbol: "AMAT", name: "Applied Materials", sector: "Technology" },
  { symbol: "MU", name: "Micron Technology", sector: "Technology" },

  // Consumer Cyclical
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Cyclical" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Cyclical" },
  { symbol: "HD", name: "Home Depot Inc.", sector: "Consumer Cyclical" },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Cyclical" },
  { symbol: "MCD", name: "McDonald's Corporation", sector: "Consumer Cyclical" },
  { symbol: "SBUX", name: "Starbucks Corporation", sector: "Consumer Cyclical" },
  { symbol: "TGT", name: "Target Corporation", sector: "Consumer Cyclical" },
  { symbol: "LOW", name: "Lowe's Companies", sector: "Consumer Cyclical" },
  { symbol: "BKNG", name: "Booking Holdings", sector: "Consumer Cyclical" },

  // Healthcare
  { symbol: "LLY", name: "Eli Lilly and Company", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
  { symbol: "MRK", name: "Merck & Co.", sector: "Healthcare" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { symbol: "TNYA", name: "Tenaya Therapeutics Inc.", sector: "Healthcare" },
  { symbol: "TMO", name: "Thermo Fisher Scientific", sector: "Healthcare" },
  { symbol: "ABT", name: "Abbott Laboratories", sector: "Healthcare" },
  { symbol: "DHR", name: "Danaher Corporation", sector: "Healthcare" },
  { symbol: "CVS", name: "CVS Health Corporation", sector: "Healthcare" },
  { symbol: "AMGN", name: "Amgen Inc.", sector: "Healthcare" },

  // Financial Services
  { symbol: "BRK.B", name: "Berkshire Hathaway Class B", sector: "Financial Services" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financial Services" },
  { symbol: "V", name: "Visa Inc.", sector: "Financial Services" },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financial Services" },
  { symbol: "BAC", name: "Bank of America Corp", sector: "Financial Services" },
  { symbol: "WFC", name: "Wells Fargo & Company", sector: "Financial Services" },
  { symbol: "GS", name: "Goldman Sachs Group", sector: "Financial Services" },
  { symbol: "MS", name: "Morgan Stanley", sector: "Financial Services" },
  { symbol: "AXP", name: "American Express Company", sector: "Financial Services" },
  { symbol: "BLK", name: "BlackRock Inc.", sector: "Financial Services" },
  { symbol: "C", name: "Citigroup Inc.", sector: "Financial Services" },
  { symbol: "SCHW", name: "Charles Schwab Corp", sector: "Financial Services" },

  // Communication Services
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Communication Services" },
  { symbol: "DIS", name: "Walt Disney Company", sector: "Communication Services" },
  { symbol: "CMCSA", name: "Comcast Corporation", sector: "Communication Services" },
  { symbol: "VZ", name: "Verizon Communications", sector: "Communication Services" },
  { symbol: "T", name: "AT&T Inc.", sector: "Communication Services" },
  { symbol: "TMUS", name: "T-Mobile US Inc.", sector: "Communication Services" },

  // Consumer Defensive
  { symbol: "PG", name: "Procter & Gamble Co", sector: "Consumer Defensive" },
  { symbol: "KO", name: "Coca-Cola Company", sector: "Consumer Defensive" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Defensive" },
  { symbol: "COST", name: "Costco Wholesale Corp", sector: "Consumer Defensive" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Defensive" },
  { symbol: "PM", name: "Philip Morris International", sector: "Consumer Defensive" },
  { symbol: "MO", name: "Altria Group Inc.", sector: "Consumer Defensive" },

  // Energy
  { symbol: "XOM", name: "Exxon Mobil Corporation", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corporation", sector: "Energy" },
  { symbol: "COP", name: "ConocoPhillips", sector: "Energy" },
  { symbol: "SLB", name: "Schlumberger NV", sector: "Energy" },
  { symbol: "EOG", name: "EOG Resources Inc.", sector: "Energy" },
  { symbol: "OKLO", name: "Oklo Inc.", sector: "Energy" },

  // Industrials
  { symbol: "BA", name: "Boeing Company", sector: "Industrials" },
  { symbol: "HON", name: "Honeywell International", sector: "Industrials" },
  { symbol: "UPS", name: "United Parcel Service", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { symbol: "GE", name: "General Electric Company", sector: "Industrials" },
  { symbol: "RTX", name: "RTX Corporation", sector: "Industrials" },
  { symbol: "LMT", name: "Lockheed Martin Corp", sector: "Industrials" },
  { symbol: "DE", name: "Deere & Company", sector: "Industrials" },

  // Utilities
  { symbol: "NEE", name: "NextEra Energy Inc.", sector: "Utilities" },
  { symbol: "DUK", name: "Duke Energy Corporation", sector: "Utilities" },
  { symbol: "SO", name: "Southern Company", sector: "Utilities" },
  { symbol: "D", name: "Dominion Energy Inc.", sector: "Utilities" },

  // Real Estate
  { symbol: "AMT", name: "American Tower Corp", sector: "Real Estate" },
  { symbol: "PLD", name: "Prologis Inc.", sector: "Real Estate" },
  { symbol: "CCI", name: "Crown Castle Inc.", sector: "Real Estate" },

  // Basic Materials
  { symbol: "LIN", name: "Linde plc", sector: "Basic Materials" },
  { symbol: "APD", name: "Air Products and Chemicals", sector: "Basic Materials" },
  { symbol: "SHW", name: "Sherwin-Williams Company", sector: "Basic Materials" },
  { symbol: "FCX", name: "Freeport-McMoRan Inc.", sector: "Basic Materials" },
  { symbol: "NEM", name: "Newmont Corporation", sector: "Basic Materials" },
].sort((a, b) => a.name.localeCompare(b.name));

export const SECTOR_COLORS: Record<string, string> = {
  "Technology": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Healthcare": "bg-green-500/10 text-green-500 border-green-500/20",
  "Financial Services": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Consumer Cyclical": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "Consumer Defensive": "bg-pink-500/10 text-pink-500 border-pink-500/20",
  "Communication Services": "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  "Energy": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  "Industrials": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Utilities": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  "Real Estate": "bg-teal-500/10 text-teal-500 border-teal-500/20",
  "Basic Materials": "bg-amber-500/10 text-amber-500 border-amber-500/20",
};
