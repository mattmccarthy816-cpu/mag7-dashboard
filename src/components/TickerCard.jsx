import React from 'react'
import Sparkline from './Sparkline'
import { fmtPrice, fmtMcap, pctChange, extractCloses } from '../api'

export default function TickerCard({ result, sym, name, isSP500 = false, isFav = false, onToggleFav }) {
  const loading = !result

  const meta = result?.meta
  const price = meta?.regularMarketPrice
  const prev = meta?.chartPreviousClose || meta?.previousClose
  const chg = price && prev ? price - prev : null
  const pct = pctChange(price, prev)
  const isUp = pct >= 0
  const sign = isUp ? '+' : ''
  const chgColor = isUp ? 'var(--up)' : 'var(--dn)'
  const closes = extractCloses(result)
  const sparkColor = isUp ? '#1fb87a' : '#e05050'
  const yearChg = closes.length > 5 ? pctChange(price, closes[0]) : null

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '0.5px solid var(--border)',
      borderLeft: isSP500 ? '3px solid var(--blue)' : undefined,
      borderRadius: 'var(--radius)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      position: 'relative',
    }}>
      {/* Fav button — not shown on S&P 500 card */}
      {!isSP500 && onToggleFav && (
        <button
          onClick={() => onToggleFav(sym)}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          style={{
            position: 'absolute',
            top: 8, right: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
            fontSize: 13,
            color: isFav ? '#e05050' : 'var(--text-muted)',
            opacity: isFav ? 1 : 0.4,
            transition: 'opacity 0.15s, color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = isFav ? '1' : '0.4'}
        >
          {isFav ? '♥' : '♡'}
        </button>
      )}

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingRight: 18 }}>
        {sym}
      </div>
      {name && !isSP500 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{name}</div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
            ${fmtPrice(price)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: chgColor }}>
            {sign}{pct?.toFixed(2)}% ({sign}${Math.abs(chg ?? 0).toFixed(2)})
          </div>
          {isSP500 && yearChg != null && (
            <div style={{ fontSize: 10, color: yearChg >= 0 ? 'var(--up)' : 'var(--dn)' }}>
              1yr: {yearChg >= 0 ? '+' : ''}{yearChg.toFixed(1)}%
            </div>
          )}
          {!isSP500 && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              {fmtMcap(meta?.marketCap)}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <Sparkline prices={closes} color={sparkColor} height={32} />
          </div>
        </>
      )}
    </div>
  )
}
