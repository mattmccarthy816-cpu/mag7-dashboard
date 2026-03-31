import React, { useState } from 'react'
import Panel from './Panel'
import { SECTORS } from '../constants'
import { extractCloses, pctChange } from '../api'

// Deep red → light red → neutral → light green → deep green
function heatColor(pct) {
  if (pct == null) return { bg:'rgba(255,255,255,0.04)', text:'#555' }
  if (pct >=  15) return { bg:'#1fb87a55', text:'#1fb87a' }
  if (pct >=   8) return { bg:'#1fb87a33', text:'#1fb87a' }
  if (pct >=   2) return { bg:'#1fb87a1a', text:'#7ab87a' }
  if (pct >=  -2) return { bg:'rgba(255,255,255,0.04)', text:'#888' }
  if (pct >=  -8) return { bg:'#e050501a', text:'#c07070' }
  if (pct >= -15) return { bg:'#e0505033', text:'#e05050' }
  return              { bg:'#e0505055', text:'#e05050' }
}

export default function AllStocksHeatmap({ allSectorData, onTickerClick }) {
  const [metric, setMetric] = useState('1Y') // '1M' or '1Y'

  // Build flat list: { sym, pct1y, pct1m, sectorColor, sectorShort }
  const cells = []
  SECTORS.forEach(s => {
    const top7 = allSectorData?.[s.id] ?? []
    s.top7.forEach((sym, i) => {
      const result = top7[i]
      const closes = extractCloses(result)
      const n = closes.length
      const pct1y = n > 1  ? pctChange(closes[n-1], closes[0]) : null
      const pct1m = n > 21 ? pctChange(closes[n-1], closes[n-22]) : n > 1 ? pctChange(closes[n-1], closes[0]) : null
      const price = result?.meta?.regularMarketPrice
      const prev  = result?.meta?.chartPreviousClose || result?.meta?.previousClose
      const pct1d = pctChange(price, prev)
      cells.push({ sym, pct1y, pct1m, pct1d, sectorColor: s.color, sectorId: s.id, sectorShort: s.short, result })
    })
  })

  const displayPct = (cell) => metric === '1Y' ? cell.pct1y : metric === '1M' ? cell.pct1m : cell.pct1d
  const metricLabel = metric === '1Y' ? '1yr' : metric === '1M' ? '1mo' : '1d'

  // Group by sector for visual separation
  const bySector = SECTORS.map(s => ({
    sector: s,
    cells: cells.filter(c => c.sectorId === s.id),
  }))

  return (
    <Panel title="All Sector Holdings" badge="quick view">
      {/* Metric toggle */}
      <div style={{ display:'flex', gap:4, marginBottom:10 }}>
        {['1D','1M','1Y'].map(m => (
          <button key={m} onClick={() => setMetric(m)} style={{
            fontSize:10, fontWeight: metric===m?700:400,
            padding:'3px 8px', borderRadius:5,
            background: metric===m ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: metric===m ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
            color: metric===m ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor:'pointer',
          }}>{m}</button>
        ))}
        <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:6, alignSelf:'center' }}>
          Colored by {metricLabel} return
        </span>
      </div>

      {/* Grid — sectors separated by small label */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {bySector.map(({ sector, cells: sCells }) => (
          <div key={sector.id}>
            {/* Sector label */}
            <div style={{ fontSize:9, fontWeight:700, color:sector.color, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:3 }}>
              {sector.short}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0,1fr))', gap:3 }}>
              {sCells.map(cell => {
                const pct = displayPct(cell)
                const { bg, text } = heatColor(pct)
                return (
                  <div
                    key={cell.sym}
                    onClick={() => onTickerClick?.(cell.sym, cell.result)}
                    style={{
                      background: bg,
                      border: `0.5px solid ${sector.color}44`,
                      borderRadius:5, padding:'4px 4px 3px',
                      cursor: cell.result ? 'pointer' : 'default',
                      textAlign:'center',
                      transition:'opacity 0.12s',
                    }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='0.75'}
                    onMouseLeave={e=>e.currentTarget.style.opacity='1'}
                    title={`${cell.sym} · ${pct!=null?((pct>=0?'+':'')+pct.toFixed(1)+'%'):'—'} ${metricLabel}`}
                  >
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text-primary)', lineHeight:1.2 }}>{cell.sym}</div>
                    <div style={{ fontSize:9, fontWeight:600, color:text, lineHeight:1.3 }}>
                      {pct!=null?(pct>=0?'+':'')+pct.toFixed(1)+'%':'—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Color legend */}
      <div style={{ display:'flex', gap:6, marginTop:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:9, color:'var(--text-muted)' }}>Return:</span>
        {[['#e05050','< -8%'],['#c07070','-2 to -8'],['#888','±2%'],['#7ab87a','+2 to +8'],['#1fb87a','> +8%']].map(([c,l])=>(
          <span key={l} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:c }}>
            <span style={{ width:6, height:6, borderRadius:1, background:c+'55', border:`0.5px solid ${c}`, display:'inline-block' }}/>
            {l}
          </span>
        ))}
      </div>
    </Panel>
  )
}
