import React from 'react'
import Sparkline from './Sparkline'
import { fmtPrice, fmtMcap, pctChange, extractCloses } from '../api'

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  sym: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  price: {
    fontSize: 18,
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginTop: 2,
  },
  chg: {
    fontSize: 12,
    fontWeight: 500,
  },
  mcap: {
    fontSize: 10,
    color: 'var(--text-secondary)',
  },
}

export default function TickerCard({ result, sym, name, color, isSP500 = false }) {
  if (!result) {
    return (
      <div style={{ ...styles.card, borderLeft: isSP500 ? '3px solid var(--blue)' : undefined }}>
        <div style={styles.sym}>{sym}</div>
        <div style={{ ...styles.price, fontSize: 14, color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    )
  }

  const meta = result.meta
  const price = meta.regularMarketPrice
  const prev = meta.chartPreviousClose || meta.previousClose
  const chg = price - prev
  const pct = pctChange(price, prev)
  const isUp = pct >= 0
  const sign = isUp ? '+' : ''
  const chgColor = isUp ? 'var(--up)' : 'var(--dn)'
  const closes = extractCloses(result)
  const sparkColor = isUp ? '#1fb87a' : '#e05050'

  // 1-year change for S&P
  const yearChg = closes.length > 5 ? pctChange(price, closes[0]) : null

  return (
    <div style={{
      ...styles.card,
      borderLeft: isSP500 ? '3px solid var(--blue)' : undefined,
    }}>
      <div style={styles.sym}>{sym}</div>
      {name && <div style={styles.name}>{name}</div>}
      <div style={styles.price}>${fmtPrice(price)}</div>
      <div style={{ ...styles.chg, color: chgColor }}>
        {sign}{pct?.toFixed(2)}% ({sign}${Math.abs(chg).toFixed(2)})
      </div>
      {isSP500 && yearChg != null && (
        <div style={{ fontSize: 10, color: yearChg >= 0 ? 'var(--up)' : 'var(--dn)' }}>
          1yr: {yearChg >= 0 ? '+' : ''}{yearChg.toFixed(1)}%
        </div>
      )}
      {!isSP500 && <div style={styles.mcap}>{fmtMcap(meta.marketCap)}</div>}
      <div style={{ marginTop: 6 }}>
        <Sparkline prices={closes} color={sparkColor} height={34} />
      </div>
    </div>
  )
}
