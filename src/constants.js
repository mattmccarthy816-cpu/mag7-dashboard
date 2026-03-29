export const MAG7 = [
  { sym: 'AAPL', name: 'Apple' },
  { sym: 'MSFT', name: 'Microsoft' },
  { sym: 'NVDA', name: 'Nvidia' },
  { sym: 'AMZN', name: 'Amazon' },
  { sym: 'GOOGL', name: 'Alphabet' },
  { sym: 'META', name: 'Meta' },
  { sym: 'TSLA', name: 'Tesla' },
]

export const TICKER_COLORS = [
  '#4a8fd4', // AAPL – blue
  '#1fb87a', // MSFT – green
  '#e8a835', // NVDA – amber
  '#e05050', // AMZN – red
  '#9b7de0', // GOOGL – purple
  '#d4507a', // META – pink
  '#4ab8b8', // TSLA – teal
]

// S&P 500 sector weights — update quarterly
// Source: SPDR as of Q1 2025
export const SP_SECTORS = [
  { name: 'Information Tech', pct: 31.4, color: '#4a8fd4' },
  { name: 'Financials',        pct: 13.2, color: '#1fb87a' },
  { name: 'Health Care',       pct: 11.8, color: '#e8a835' },
  { name: 'Consumer Disc.',    pct: 10.5, color: '#9b7de0' },
  { name: 'Industrials',       pct:  8.7, color: '#d4507a' },
  { name: 'Communication',     pct:  8.4, color: '#4ab8b8' },
  { name: 'Consumer Staples',  pct:  5.9, color: '#a0a0a0' },
  { name: 'Energy',            pct:  3.8, color: '#e05050' },
  { name: 'Real Estate',       pct:  2.4, color: '#88b04b' },
  { name: 'Materials',         pct:  2.2, color: '#c97f3e' },
  { name: 'Utilities',         pct:  2.0, color: '#6bb5c9' },
]
