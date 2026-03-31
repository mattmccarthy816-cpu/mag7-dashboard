import React from 'react'
import Panel from './Panel'
import { SECTORS } from '../constants'
import { extractCloses, pctChange } from '../api'

function perfColor(pct) {
  if (pct == null) return { bg:'var(--bg-secondary)', text:'var(--text-muted)', border:'var(--border)' }
  if (pct >=  5)   return { bg:'#1fb87a33', text:'#1fb87a', border:'#1fb87a55' }
  if (pct >=  2)   return { bg:'#1fb87a1a', text:'#1fb87a', border:'#1fb87a33' }
  if (pct >=  0)   return { bg:'#1fb87a0d', text:'#7ab87a', border:'#1fb87a22' }
  if (pct >= -2)   return { bg:'#e050500d', text:'#c07070', border:'#e0505022' }
  if (pct >= -5)   return { bg:'#e050501a', text:'#e05050', border:'#e0505033' }
  return              { bg:'#e0505033', text:'#e05050', border:'#e0505055' }
}

export default function SectorHeatmap({ sectorEtfResults, spyResult, activeSector, onSectorClick }) {
  const sectorCells = SECTORS.map(s => {
    const result  = sectorEtfResults?.[s.id]
    const closes  = extractCloses(result)
    const n = closes.length
    const pct1m = n > 21 ? pctChange(closes[n-1], closes[n-22]) : n > 1 ? pctChange(closes[n-1], closes[0]) : null
    const pct1y = n > 1  ? pctChange(closes[n-1], closes[0]) : null
    return { id: s.id, label: s.short, color: s.color, pct1m, pct1y, sector: s }
  })

  // S&P 500 cell
  const spyCloses = extractCloses(spyResult)
  const spN = spyCloses.length
  const spPct1m = spN > 21 ? pctChange(spyCloses[spN-1], spyCloses[spN-22]) : null
  const spPct1y = spN > 1  ? pctChange(spyCloses[spN-1], spyCloses[0]) : null
  const sp500Cell = { id:'sp500', label:'S&P 500', color:'#4a8fd4', pct1m: spPct1m, pct1y: spPct1y, sector: null }

  const allCells = [...sectorCells, sp500Cell].sort((a,b) => (b.pct1m ?? -99) - (a.pct1m ?? -99))

  return (
    <Panel title="Sector Rotation" badge="1 month · click to switch">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:5 }}>
        {allCells.map(cell => {
          const { bg, text, border } = perfColor(cell.pct1m)
          const isActive = cell.id !== 'sp500' && cell.id === activeSector?.id
          const isSP500  = cell.id === 'sp500'
          return (
            <div
              key={cell.id}
              onClick={() => cell.sector && onSectorClick(cell.sector)}
              style={{
                background: bg,
                border: isActive ? `2px solid ${cell.color}` : `0.5px solid ${border}`,
                borderLeft: isSP500 ? `3px solid ${cell.color}` : undefined,
                borderRadius: 8,
                padding: '7px 9px',
                cursor: cell.sector ? 'pointer' : 'default',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { if (cell.sector) e.currentTarget.style.opacity='0.78' }}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}
            >
              <div style={{ fontSize:10, fontWeight:600, color: isActive ? cell.color : isSP500 ? cell.color : 'var(--text-secondary)', marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {cell.label}
              </div>
              <div style={{ fontSize:15, fontWeight:700, color: text }}>
                {cell.pct1m != null ? (cell.pct1m>=0?'+':'')+cell.pct1m.toFixed(1)+'%' : '—'}
              </div>
              <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:1 }}>
                1yr: {cell.pct1y != null ? (cell.pct1y>=0?'+':'')+cell.pct1y.toFixed(1)+'%' : '—'}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:8 }}>
        Sorted by 1-month return · S&P 500 included for comparison
      </div>
    </Panel>
  )
}
