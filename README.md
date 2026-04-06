# Mag7 Market Dashboard

A real-time market dashboard tracking the Magnificent 7 stocks, S&P 500, Fear & Greed Index, sector weights, and tech vs market performance.

## What it shows

- **Ticker row**: All 7 Mag7 stocks + S&P 500 with live price, daily % change, market cap, and 1-year sparkline
- **Fear & Greed Index**: Live from CNN's public endpoint
- **S&P 500 panel**: Price, daily change, 1-year %, and sparkline
- **Sector breakdown**: S&P 500 by sector weight (top 3 highlighted)
- **Tech vs Market**: XLK/SPY ratio chart over 1 year — rising = tech outperforming
- **Mag 7 Market Cap**: Bar chart with combined total
- **Placeholder panel**: Ready for your next custom index

## Data sources

All data is free, no API keys required:
- **Yahoo Finance** via `corsproxy.io` for stock prices, market caps, and historical closes
- **CNN Fear & Greed** via `production.dataviz.cnn.io` (public endpoint)
- **S&P Sector weights**: Baked into `src/constants.js` — update quarterly from [SPDR](https://www.ssga.com/us/en/intermediary/etfs/funds/spdr-sp-500-etf-trust-spy)

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Framework: **Vite** (auto-detected)
4. Click Deploy — done

No environment variables needed.

## Customization

### Update sector weights
Edit `src/constants.js` → `SP_SECTORS` array. Do this quarterly.

### Add the placeholder index
Replace `<PlaceholderPanel />` in `src/App.jsx` with your own panel component. The `Panel` wrapper component in `src/components/Panel.jsx` makes it easy to scaffold new panels.

### Change refresh interval
Edit `REFRESH_MS` in `src/App.jsx` (default: 60 seconds).

### Add more tickers
Add entries to the `MAG7` array in `src/constants.js` and a corresponding color in `TICKER_COLORS`.

## Project structure

```
src/
  App.jsx              — Layout and data fetching
  api.js               — Yahoo Finance + Fear & Greed fetch utils
  constants.js         — MAG7 list, colors, sector weights
  index.css            — Global dark theme + CSS variables
  components/
    Panel.jsx           — Generic card wrapper
    Sparkline.jsx       — Chart.js line sparkline
    TickerCard.jsx      — Individual stock card
    FearGreedPanel.jsx  — CNN Fear & Greed gauge
    SP500Panel.jsx      — S&P 500 summary + sparkline
    SectorPanel.jsx     — S&P 500 sector weight bars
    TechRatioPanel.jsx  — XLK/SPY ratio chart
    McapPanel.jsx       — Mag7 market cap bar chart
    PlaceholderPanel.jsx — Future index slot
```
