# Akleao Finance

A modern, beginner-friendly stock dashboard built with Next.js, shadcn/ui, and real-time stock data.

![Akleao Finance Dashboard](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-cyan?logo=tailwindcss)

## Features

- 📊 **Real-time Stock Data** - Live quotes and historical data via Alpha Vantage API
- 📈 **Interactive Charts** - Beautiful charts with multiple timeframes (1D, 1W, 1M, 3M, 1Y)
- 🎯 **Key Metrics** - Market cap, P/E ratio, dividend yield, volume, and more
- 🌙 **Dark Mode** - Optimized dark theme with Vercel/Linear-inspired design
- 📱 **Responsive** - Mobile-first design that works on all devices
- ⚡ **Fast & Modern** - Built with Next.js 15, React 19, and TypeScript

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Charts**: [Recharts](https://recharts.org/) via shadcn/ui charts
- **Data Fetching**: [TanStack Query](https://tanstack.com/query) (React Query)
- **Stock API**: [Alpha Vantage](https://www.alphavantage.co/)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- An Alpha Vantage API key (free tier available)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd akleao-finance-v0
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your API key:
   - Copy `.env.example` to `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Get your free API key at [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
   - Add your API key to `.env.local`:
     ```
     NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_api_key_here
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Rate Limits

The Alpha Vantage free tier includes:
- 25 API requests per day
- 5 API requests per minute

The app includes automatic fallback to mock data if API limits are exceeded.

## Project Structure

```
akleao-finance-v0/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── providers.tsx      # React Query provider
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── stock-selector.tsx # Stock picker component
│   ├── stock-chart.tsx    # Chart component
│   └── key-metrics.tsx    # Metrics display
├── lib/                   # Utilities
│   ├── utils.ts          # Helper functions
│   └── stock-api.ts      # Stock API integration
└── public/               # Static assets
```

## Customization

### Adding More Stocks

Edit the `POPULAR_STOCKS` array in `components/stock-selector.tsx`:

```typescript
const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "YOUR_SYMBOL", name: "Your Stock" },
  // Add more...
];
```

### Changing Theme Colors

Modify the CSS variables in `app/globals.css` to customize the color scheme.

## Future Enhancements

- [ ] User authentication and watchlists
- [ ] Portfolio tracking
- [ ] News feed integration
- [ ] Stock comparison view
- [ ] Price alerts
- [ ] Additional chart types (candlestick, line, bar)
- [ ] Search functionality with autocomplete

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Design inspired by [Vercel](https://vercel.com), [Linear](https://linear.app), and [Supabase](https://supabase.com)
- Stock data provided by [Alpha Vantage](https://www.alphavantage.co/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
