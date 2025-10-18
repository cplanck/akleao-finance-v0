# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Akleao Finance is a modern stock dashboard designed for beginners to learn about and evaluate companies. The app displays real-time stock data with interactive charts, key metrics, and company information.

**Key Features:**
- Real-time stock quotes and historical data
- Interactive Robinhood-style charts with dynamic Y-axis and multiple timeframes (1D, 1W, 1M, 3M, 1Y)
- AI-powered explanations for key metrics using OpenAI
- Searchable S&P 500 stock dropdown with 100+ stocks
- Industry/sector badges with color coding
- Key metrics display (market cap, P/E ratio, dividend yield, volume, etc.)
- Clean, dark-mode interface inspired by Vercel, Linear, and Supabase

## Architecture

**Tech Stack:**
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with CSS variables
- **Components**: shadcn/ui (headless, composable components)
- **Charts**: Recharts via shadcn/ui chart components
- **Data Fetching**: TanStack Query (React Query)
- **Stock API**: Alpha Vantage (free tier: 25 requests/day)

**Project Structure:**
```
app/
  layout.tsx          # Root layout with Providers
  page.tsx            # Main dashboard page with sector badges
  providers.tsx       # React Query provider setup
  globals.css         # Global styles with CSS variables
  api/
    explain/
      route.ts        # OpenAI API route for metric explanations
components/
  ui/                 # shadcn/ui components (auto-generated)
  stock-selector.tsx  # Searchable S&P 500 dropdown + popular stocks
  stock-chart.tsx     # Robinhood-style chart with dynamic Y-axis
  key-metrics.tsx     # Metrics grid display
  metric-card-with-ai.tsx  # Individual metric card with AI explanation popover
lib/
  utils.ts            # cn() utility for class merging
  stock-api.ts        # Alpha Vantage API integration
  sp500-stocks.ts     # S&P 500 stock list with sectors
```

**Key Design Patterns:**
- Server Components for layouts, Client Components for interactivity
- React Query for data fetching, caching, and state management
- CSS variables for theming (supports light/dark modes)
- Fallback to mock data when API limits are exceeded
- Responsive design with mobile-first approach

## Development Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env.local` file with:
```
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

- **Alpha Vantage API key**: https://www.alphavantage.co/support/#api-key (free)
- **OpenAI API key**: https://platform.openai.com/api-keys (pay-as-you-go)

## Important Notes

- **API Rate Limits**: Alpha Vantage free tier has 25 requests/day, 5/minute
- **OpenAI Usage**: AI explanations use gpt-4o-mini, ~$0.15 per 1M input tokens
- **Fallback Data**: App uses mock data when API calls fail or limits are exceeded
- **Dark Mode**: App is dark mode by default (`className="dark"` on `<html>`)
- **Component Registry**: Use `npx shadcn@latest add [component]` to add new shadcn components
- **Type Safety**: All API responses have TypeScript interfaces defined in `lib/stock-api.ts`
- **Robinhood-Style Chart**: Y-axis uses dynamic domain based on data min/max with 10% padding
- **S&P 500 Stocks**: 100+ major stocks from all sectors available in searchable dropdown
- **Sector Colors**: Color-coded badges for easy visual identification of industries
