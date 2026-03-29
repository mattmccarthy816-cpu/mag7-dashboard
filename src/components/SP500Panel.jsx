import React from 'react'
import Panel from './Panel'
import Sparkline from './Sparkline'
import { fmtPrice, pctChange, extractCloses } from '../api'

export default function SP500Panel({ result }) {
  if (!result) {
    return (
      <Panel title="S&P 500">
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      </Panel>
    )
  }

  const meta = result.meta
  const price = meta.regularMarketPrice
  const prev = meta.chartPreviousClose || meta.previousClose
  const chg = price - prev
  const pct = pctChange(price, prev)
  const isUp = pct >= 0
  const sign = isUp ? '+' : ''
  const closes = extractCloses(result)
  const yearChg = closes.length > 5 ? pctChange(price, closes[0]) : null

  return (
    <Panel title="S&P 500">
      <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>
        {fmtPrice(price)}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: isUp ? 'var(--up)' : 'var(--dn)',
        marginTop: 4,
      }}>
        {sign}{pct?.toFixed(2)}% today ({sign}{chg.toFixed(2)} pts)
      </div>
      {yearChg != null && (
        <div style={{
          fontSize: 11,
          color: yearChg >= 0 ? 'var(--up)' : 'var(--dn)',
          marginTop: 3,
        }}>
          1-year: {yearChg >= 0 ? '+' : ''}{yearChg.toFixed(1)}%
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Sparkline prices={closes} color={isUp ? '#1fb87a' : '#e05050'} height={52} />
      </div>
    </Panel>
  )
}
