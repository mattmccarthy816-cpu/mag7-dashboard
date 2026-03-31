import React from 'react'
import Panel from './Panel'
import { SECTORS } from '../constants'
import { extractCloses, pctChange } from '../api'

function perfColor(pct) {
  if (pct == null) return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)' }
  if (pct >= 5)   return { bg: '#1fb87a33', text: '#1fb87a', border: '#1fb87a55' }
  if (pct >= 2)   return { bg: '#1fb87a1a', text: '#1fb87a', border: '#1fb87a33' }
  if (pct >= 0)   return { bg: '#1fb87a0d', text: '#7ab87a', border: '#1fb87a22' }
  if (pct >= -2)  return { bg: '#e050500d', text: '#c07070', border: '#e0505022' }
  if (pct >= -5)  return { bg: '#e050501a', text: '#e05050', border: '#e0505033' }
  return             { bg: '#e0505033', text: '#e05050', border: '#e0505055' }
}

export default function SectorHeatmap({ sectorEtfResults, activeSector, onSectorClick }) {
  // sectorEtfResults: { sectorId: yahooResult }
  const cells = SECTORS.map(s => {
    const result = sectorEtfResults?.[s.id]
    const closes = extractCloses(result)
    const n = closes.length
    // 1-month ≈ last 21 trading days
    const pct1m = n > 21 ? pctChange(closes[n-1], closes[n-22]) : (n > 1 ? pctChange(closes[n-1], closes[0]) : null)
    const pct1y = n > 1 ? pctChange(closes[n-1], closes[0]) : null
    return { s, pct1m, pct1y }
  })

  const sorted = [...cells].sort((a, b) => (b.pct1m ?? -99) - (a.pct1m ?? -99))

  return (
    <Panel title="Sector Rotation" badge="1 month performance">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
        gap: 6,
      }}>
        {sorted.map(({ s, pct1m, pct1y }) => {
          const { bg, text, border } = perfColor(pct1m)
          const isActive = s.id === activeSector.id
          return (
            <div
              key={s.id}
              onClick={() => onSectorClick(s)}
              style={{
                background: bg,
                border: `${isActive ? '2px' : '0.5px'} solid ${isActive ? s.color : (border ?? 'var(--border)')}`,
                borderRadius: 8, padding: '8px 10px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: isActive ? s.color : 'var(--text-secondary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.short}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: text }}>
                {pct1m != null ? (pct1m >= 0 ? '+' : '') + pct1m.toFixed(1) + '%' : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                1yr: {pct1y != null ? (pct1y >= 0 ? '+' : '') + pct1y.toFixed(1) + '%' : '—'}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
        Sorted by 1-month return · Click to switch sector
      </div>
    </Panel>
  )
}
