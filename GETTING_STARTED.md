# Getting Started with Akleao Finance

Welcome! This guide will help you get the Akleao Finance dashboard up and running.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get your API key**
   - Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
   - Sign up for a free API key (takes 30 seconds)
   - Copy your API key

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API key:
   ```
   NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=YOUR_KEY_HERE
   ```

4. **Start the app**
   ```bash
   npm run dev
   ```

5. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## What You'll See

- **Popular Stocks**: Quick access buttons for AAPL, MSFT, GOOGL, TSLA, NVDA, AMZN
- **Stock Overview**: Current price, change, and percentage
- **Interactive Chart**: Click timeframe buttons (1D, 1W, 1M, 3M, 1Y) to change the view
- **Key Metrics**: Market cap, P/E ratio, dividend yield, volume, 52-week highs/lows, EPS, beta
- **Company Info**: Description, sector, industry, employees, market cap

## Understanding the Data

### Key Metrics Explained (for Beginners)

- **Market Cap**: Total value of all company shares. Bigger = larger company
- **P/E Ratio**: Price-to-Earnings ratio. Lower often means better value, but context matters
- **Dividend Yield**: Percentage of price paid as dividends annually
- **Volume**: Number of shares traded today
- **52 Week High/Low**: Highest and lowest prices in the past year
- **EPS**: Earnings per share. How much profit each share represents
- **Beta**: Volatility measure. >1 = more volatile than market, <1 = less volatile

## API Usage Tips

**Free Tier Limits:**
- 25 API calls per day
- 5 API calls per minute

**What counts as a call:**
- Selecting a stock = 2 calls (quote + overview)
- Changing timeframe = 1 call (chart data)

**Pro tip**: The app caches data for 1 minute, so switching between stocks you've already viewed won't use extra API calls!

**Fallback**: If you hit rate limits, the app will show mock data so you can still use it.

## Troubleshooting

### "Loading..." stuck on screen
- Check that your API key is correct in `.env.local`
- Make sure you've restarted the dev server after adding the API key
- Check browser console for error messages

### Rate limit exceeded
- Wait a few minutes before making more requests
- The app will automatically fall back to mock data

### Charts not showing
- This is normal when using the demo API key
- Get your own free API key to see real data

## Next Steps

Now that you're up and running, try:

1. Exploring different stocks (click the stock buttons)
2. Viewing different timeframes on the charts
3. Reading the company descriptions
4. Comparing metrics across different companies

## Need Help?

- Check the main [README.md](./README.md) for more details
- Review [CLAUDE.md](./CLAUDE.md) for architecture details
- Check [WIREFRAME.md](./WIREFRAME.md) for design specifications

Happy investing! 📈
