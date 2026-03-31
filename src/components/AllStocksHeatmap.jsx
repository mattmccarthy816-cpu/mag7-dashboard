import React, { useState, useMemo } from 'react'
import Panel from './Panel'
import { SECTORS } from '../constants'
import { extractCloses, pctChange } from '../api'

// Build sector lookup: sym → { color, short }
const SYM_SECTOR = {}
SECTORS.forEach(s => s.top7.forEach(sym => { SYM_SECTOR[sym] = { color: s.color, short: s.short } }))

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
  if (pct == null) return '#555'
  if (pct >= 2)    return '#1fb87a'
  if (pct >= -2)   return '#888'
  return '#e05050'
}

const METRICS = [
  { label:'1D', get: r => pctChange(r?.meta?.regularMarketPrice, r?.meta?.chartPreviousClose || r?.meta?.previousClose) },
  { label:'1M', get: r => { const c = extractCloses(r); return c.length > 21 ? pctChange(c[c.length-1],c[c.length-22]) : c.length>1 ? pctChange(c[c.length-1],c[0]) : null } },
  { label:'1Y', get: r => { const c = extractCloses(r); return c.length > 1 ? pctChange(c[c.length-1],c[0]) : null } },
]

export default function AllStocksHeatmap({ allSectorData, spyResult, onTickerClick }) {
  const [metric, setMetric] = useState(2)
  const [sortDir, setSortDir] = useState(-1)

  const getPct = METRICS[metric].get

  // S&P 500 1Y/1M/1D pct
  const spyCloses = extractCloses(spyResult)
  const spN = spyCloses.length
  const spyPct = metric === 0
    ? pctChange(spyResult?.meta?.regularMarketPrice, spyResult?.meta?.chartPreviousClose)
    : metric === 1
      ? (spN > 21 ? pctChange(spyCloses[spN-1], spyCloses[spN-22]) : null)
      : (spN > 1  ? pctChange(spyCloses[spN-1], spyCloses[0]) : null)

  // All 77 stocks sorted
  const sorted = useMemo(() => {
    const cells = []
    SECTORS.forEach(s => {
      const top7 = allSectorData?.[s.id] ?? []
      s.top7.forEach((sym, i) => {
        const result = top7[i] ?? null
        cells.push({ sym, result, pct: result ? getPct(result) : null, sectorColor: s.color })
      })
    })
    return cells.sort((a, b) => {
      if (a.pct == null && b.pct == null) return 0
      if (a.pct == null) return 1
      if (b.pct == null) return -1
      return sortDir * (b.pct - a.pct)
    })
  }, [allSectorData, metric, sortDir])

  // Layout: ~10 cols so 77 stocks ≈ 8 rows. S&P 500 fills remainder of last row.
  const COLS = 10
  const stockCount = sorted.length  // 77
  const totalCells = Math.ceil(stockCount / COLS) * COLS
  const spyCols = totalCells - stockCount  // how many cols S&P 500 gets

  return (
    <Panel title="All Sector Holdings" badge={`${stockCount} stocks · ${METRICS[metric].label} return`}>
      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
          {METRICS.map((m, i) => (
            <button key={m.label} onClick={() => setMetric(i)} style={{
              fontSize:10, fontWeight: metric===i?700:400,
              padding:'3px 9px', borderRadius:5,
              background: metric===i ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: metric===i ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              color: metric===i ? 'var(--text-primary)' : 'var(--text-muted)', cursor:'pointer',
            }}>{m.label}</button>
          ))}
          <button onClick={() => setSortDir(d => d*-1)} style={{
            fontSize:10, padding:'3px 9px', borderRadius:5, marginLeft:4,
            background:'transparent', border:'1px solid transparent',
            color:'var(--text-muted)', cursor:'pointer',
          }}>
            {sortDir === -1 ? '↓ Best first' : '↑ Worst first'}
          </button>
        </div>
        {/* Sector legend */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 8px' }}>
          {SECTORS.map(s => (
            <span key={s.id} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'var(--text-muted)' }}>
              <span style={{ width:7,height:7,borderRadius:2,background:s.color+'44',border:`1px solid ${s.color}88`,display:'inline-block' }}/>
              {s.short}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS}, minmax(0,1fr))`, gap:4 }}>
        {sorted.map(cell => (
          <div
            key={cell.sym}
            onClick={() => cell.result && onTickerClick?.(cell.sym, cell.result)}
            title={`${cell.sym} (${SYM_SECTOR[cell.sym]?.short ?? ''}): ${cell.pct != null ? (cell.pct>=0?'+':'')+cell.pct.toFixed(1)+'%' : '—'}`}
            style={{
              background: heatBg(cell.pct),
              border: `0.5px solid ${cell.sectorColor}44`,
              borderTop: `2px solid ${cell.sectorColor}`,
              borderRadius:5, padding:'5px 3px', textAlign:'center',
              cursor: cell.result ? 'pointer' : 'default',
              transition:'opacity 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity='0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}
          >
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cell.sym}</div>
            <div style={{ fontSize:9, fontWeight:600, color:heatText(cell.pct), lineHeight:1.3 }}>
              {cell.pct != null ? (cell.pct>=0?'+':'')+cell.pct.toFixed(1)+'%' : '—'}
            </div>
          </div>
        ))}

        {/* S&P 500 fills the remaining slots in the last row */}
        {spyCols > 0 && (
          <div
            style={{
              gridColumn: `span ${spyCols}`,
              background: heatBg(spyPct),
              border: '0.5px solid #4a8fd444',
              borderTop: '2px solid #4a8fd4',
              borderLeft: '3px solid #4a8fd4',
              borderRadius:5, padding:'5px 10px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              cursor:'default',
            }}
          >
            <div style={{ fontSize:10, fontWeight:700, color:'#4a8fd4' }}>S&P 500</div>
            <div style={{ fontSize:12, fontWeight:700, color:heatText(spyPct) }}>
              {spyPct != null ? (spyPct>=0?'+':'')+spyPct.toFixed(1)+'%' : '—'}
            </div>
            <div style={{ fontSize:9, color:'var(--text-muted)' }}>{METRICS[metric].label}</div>
          </div>
        )}
      </div>

      {/* Scale */}
      <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:9, color:'var(--text-muted)' }}>Scale:</span>
        {[['#e05050','< −8%'],['#c07070','−2–8%'],['#888','±2%'],['#7ab87a','+2–8%'],['#1fb87a','> +8%']].map(([c,l]) => (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:c }}>
            <span style={{ width:7,height:7,borderRadius:1,background:c+'44',border:`0.5px solid ${c}88`,display:'inline-block' }}/>
            {l}
          </span>
        ))}
        <span style={{ fontSize:9, color:'var(--text-muted)', marginLeft:4 }}>Top border = sector color</span>
      </div>
    </Panel>
  )
}
