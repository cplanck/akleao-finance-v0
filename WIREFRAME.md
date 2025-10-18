# Akleao Finance Dashboard - Wireframe

## Design Philosophy
- Clean, modern interface inspired by Vercel, Linear, and Supabase
- Beginner-friendly with clear visual hierarchy
- Dark mode optimized with subtle gradients
- Responsive design (mobile-first approach)

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                         │
│  ┌──────────────┐                              ┌─────┐ ┌─────┐ │
│  │ Akleao       │                              │  🔍 │ │ 👤  │ │
│  │ Finance      │                              └─────┘ └─────┘ │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
│                                                                 │
│  MAIN CONTENT AREA                                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Stock Search / Selector                                  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Search for a stock...                        ↓     │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  Popular / Watchlist (chips)                              │ │
│  │  [ AAPL ] [ MSFT ] [ GOOGL ] [ TSLA ] [ NVDA ]           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Selected Stock: AAPL                                     │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Apple Inc.                                         │  │ │
│  │  │  $178.45  ↗ +2.34 (+1.33%)                         │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Price Chart                                              │ │
│  │  ┌───────────────────────────────────────────┐            │ │
│  │  │ [ 1D ] [ 1W ] [ 1M ] [ 3M ] [ 1Y ] [ ALL] │           │ │
│  │  └───────────────────────────────────────────┘            │ │
│  │                                                            │ │
│  │      180 ┤                              ╱─╲               │ │
│  │          │                          ╱──╯   ╲              │ │
│  │      175 ┤                      ╱──╯        ╲             │ │
│  │          │                  ╱──╯             ╲─╮          │ │
│  │      170 ┤              ╱──╯                   ╰─╮        │ │
│  │          │          ╱──╯                           ╲      │ │
│  │      165 ┤      ╱──╯                                ╲    │ │
│  │          └──────┬────┬────┬────┬────┬────┬────┬─────    │ │
│  │               Mon  Tue  Wed  Thu  Fri  Sat  Sun         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Key Metrics (Cards Grid)                                 │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │ │
│  │  │ Market   │ │  P/E     │ │ Div Yield│ │  Volume  │    │ │
│  │  │ Cap      │ │  Ratio   │ │          │ │          │    │ │
│  │  │          │ │          │ │          │ │          │    │ │
│  │  │ $2.8T    │ │  29.5    │ │  0.52%   │ │  45.2M   │    │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Company Info (Expandable Section)                        │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  About                                              │  │ │
│  │  │  Apple Inc. designs, manufactures, and markets...  │  │ │
│  │  │                                                     │  │ │
│  │  │  Sector: Technology                                │  │ │
│  │  │  Industry: Consumer Electronics                    │  │ │
│  │  │  Employees: 164,000                                │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Header
- **Logo/Branding**: "Akleao Finance" - subtle gradient text
- **Search Icon**: Quick stock lookup (cmd+k trigger)
- **User Avatar**: Account menu

### 2. Stock Selector
- **Combobox/Select Component**: Searchable dropdown with autocomplete
- **Popular Stocks Chips**: Quick access buttons for commonly viewed stocks
- **Recent/Watchlist**: User's saved stocks (future feature)

### 3. Stock Overview Card
- **Company Name**: Large, bold
- **Current Price**: Primary metric, large font
- **Price Change**: Color-coded (green ↗ / red ↘) with percentage
- **Badge**: Real-time/Delayed indicator

### 4. Interactive Chart
- **Time Range Selector**: Tab-style buttons (1D, 1W, 1M, 3M, 1Y, ALL)
- **Line Chart**: Clean, minimal design with gradient fill
- **Tooltips**: Hover to see exact price at timestamp
- **Responsive**: Adapts to screen size

### 5. Key Metrics Grid
- **Card Components**: 4-column grid (responsive: 2-col on tablet, 1-col on mobile)
- **Metrics Include**:
  - Market Cap
  - P/E Ratio
  - Dividend Yield
  - Volume
  - 52-Week High/Low
  - EPS
  - Beta
  - More metrics expandable

### 6. Company Information
- **Collapsible Section**: Accordion or expandable card
- **About**: Company description
- **Metadata**: Sector, industry, employees, headquarters
- **Educational Tooltips**: "?" icons explaining financial terms for beginners

---

## Color Scheme (Dark Mode Primary)

```
Background: #0A0A0A (near black)
Surface: #18181B (zinc-900)
Border: #27272A (zinc-800)
Text Primary: #FAFAFA (white)
Text Secondary: #A1A1AA (zinc-400)
Accent: #3B82F6 (blue-500)
Success: #10B981 (emerald-500)
Danger: #EF4444 (red-500)
```

---

## Tech Stack Recommendations

### UI Components
- **shadcn/ui**: Card, Select, Tabs, Button, Badge, Tooltip, Accordion
- **Radix UI**: Headless primitives for accessibility
- **Tailwind CSS**: Utility-first styling

### Charting
- **Recharts**: Simple, composable React charts
- **Alternative**: Chart.js with react-chartjs-2
- **Advanced**: TradingView Lightweight Charts (if more trading-focused)

### Data Source
- **Free Options**:
  - Alpha Vantage (500 calls/day free tier)
  - Finnhub (60 calls/minute free tier)
  - Yahoo Finance API (via RapidAPI or unofficial libraries)
  - Twelve Data (800 calls/day free tier)
- **Recommended**: Start with Finnhub or Alpha Vantage

### State Management
- **React Query**: For data fetching and caching
- **Zustand**: Lightweight state (user preferences, watchlist)

---

## Mobile Responsive Breakpoints

- **Mobile**: < 640px - Single column, stacked layout
- **Tablet**: 640px - 1024px - 2-column metrics grid
- **Desktop**: > 1024px - Full layout as shown

---

## Future Enhancements

- User authentication and watchlists
- Portfolio tracking
- Educational overlays explaining metrics
- News feed integration
- Comparison view (multiple stocks)
- Alerts and notifications
- Historical analysis tools
