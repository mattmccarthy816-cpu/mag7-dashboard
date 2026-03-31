import React, { useState, useMemo } from 'react'
import Panel from './Panel'
import { SECTORS } from '../constants'
import { extractCloses, pctChange } from '../api'

function heatBg(pct) {
  if (pct == null) return 'rgba(255,255,255,0.03)'
  if (pct >=  15)  return '#1fb87a55'
  if (pct >=   8)  return '#1fb87a33'
  if (pct >=   2)  return '#1fb87a1a'
  if (pct >=  -2)  return 'rgba(255,255,255,0.03)'
  if (pct >=  -8)  return '#e050501a'
  if (pct >= -15)  return '#e0505033'
  return               '#e0505055'
}
function heatText(pct) {
  if (pct == null) return '#666'
  if (pct >=  2)   return '#1fb87a'
  if (pct >= -2)   return '#888'
  return '#e05050'
}

const METRICS = [
  { label: '1D', get: (r) => pctChange(r?.meta?.regularMarketPrice, r?.meta?.chartPreviousClose || r?.meta?.previousClose) },
  { label: '1M', get: (r) => { const c = extractCloses(r); return c.length > 21 ? pctChange(c[c.length-1], c[c.length-22]) : c.length > 1 ? pctChange(c[c.length-1], c[0]) : null } },
  { label: '1Y', get: (r) => { const c = extractCloses(r); return c.length > 1 ? pctChange(c[c.length-1], c[0]) : null } },
]

export default function AllStocksHeatmap({ allSectorData, onTickerClick }) {
  const [metric, setMetric] = useState(2) // index into METRICS, default 1Y
  const [sortDir, setSortDir] = useState(-1) // -1 = desc (best first), 1 = asc

  const getPct = METRICS[metric].get

  // Build flat list of all stocks
  const allCells = useMemo(() => {
    const cells = []
    SECTORS.forEach(s => {
      const top7 = allSectorData?.[s.id] ?? []
      s.top7.forEach((sym, i) => {
        const result = top7[i] ?? null
        const pct = result ? getPct(result) : null
        cells.push({ sym, result, pct, sectorColor: s.color, sectorShort: s.short })
      })
    })
    return cells.sort((a, b) => {
      if (a.pct == null && b.pct == null) return 0
      if (a.pct == null) return 1
      if (b.pct == null) return -1
      return sortDir * (b.pct - a.pct)
    })
  }, [allSectorData, metric, sortDir])

  return (
    <Panel title="All Sector Holdings" badge="77 stocks">
      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:3 }}>
          {METRICS.map((m, i) => (
            <button key={m.label} onClick={() => setMetric(i)} style={{
              fontSize:10, fontWeight: metric===i ? 700 : 400,
              padding:'3px 9px', borderRadius:5,
              background: metric===i ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: metric===i ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              color: metric===i ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor:'pointer',
            }}>{m.label}</button>
          ))}
          <button onClick={() => setSortDir(d => d * -1)} style={{
            fontSize:10, padding:'3px 9px', borderRadius:5,
            background:'transparent', border:'1px solid transparent',
            color:'var(--text-muted)', cursor:'pointer', marginLeft:4,
          }} title="Toggle sort direction">
            {sortDir === -1 ? '↓ Best first' : '↑ Worst first'}
          </button>
        </div>

        {/* Sector legend */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 8px' }}>
          {SECTORS.map(s => (
            <span key={s.id} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'var(--text-muted)' }}>
              <span style={{ width:8, height:8, borderRadius:2, background: s.color+'44', border:`1px solid ${s.color}88`, display:'inline-block' }}/>
              {s.short}
            </span>
          ))}
        </div>
      </div>

      {/* Flat grid — sorted, sector-colored borders only */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(72px, 1fr))', gap:4 }}>
        {allCells.map(cell => (
          <div
            key={cell.sym}
            onClick={() => cell.result && onTickerClick?.(cell.sym, cell.result)}
            title={`${cell.sym} (${cell.sectorShort}): ${cell.pct != null ? (cell.pct>=0?'+':'')+cell.pct.toFixed(1)+'%' : '—'} ${METRICS[metric].label}`}
            style={{
              background: heatBg(cell.pct),
              border: `1px solid ${cell.sectorColor}55`,
              borderTop: `2px solid ${cell.sectorColor}`,
              borderRadius:5,
              padding:'5px 4px',
              textAlign:'center',
              cursor: cell.result ? 'pointer' : 'default',
              transition:'opacity 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity='0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}
          >
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {cell.sym}
            </div>
            <div style={{ fontSize:9, fontWeight:600, color: heatText(cell.pct), lineHeight:1.3 }}>
              {cell.pct != null ? (cell.pct>=0?'+':'')+cell.pct.toFixed(1)+'%' : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Return scale legend */}
      <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:9, color:'var(--text-muted)' }}>Scale:</span>
        {[['#e05050','< −8%'],['#c07070','−2–8%'],['#888','±2%'],['#7ab87a','+2–8%'],['#1fb87a','> +8%']].map(([c,l]) => (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:c }}>
            <span style={{ width:7, height:7, borderRadius:1, background:c+'44', border:`0.5px solid ${c}88`, display:'inline-block' }}/>
            {l}
          </span>
        ))}
        <span style={{ fontSize:9, color:'var(--text-muted)', marginLeft:6 }}>Border color = sector · Click to expand</span>
      </div>
    </Panel>
  )
}
