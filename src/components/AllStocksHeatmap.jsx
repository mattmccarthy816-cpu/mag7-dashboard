import React, { useState } from 'react'
import Panel from './Panel'
import { SECTORS } from '../constants'
import { extractCloses, pctChange } from '../api'

function heatColor(pct) {
  if (pct == null) return { bg:'rgba(255,255,255,0.04)', text:'#666' }
  if (pct >=  15)  return { bg:'#1fb87a55', text:'#1fb87a' }
  if (pct >=   8)  return { bg:'#1fb87a33', text:'#1fb87a' }
  if (pct >=   2)  return { bg:'#1fb87a1a', text:'#7ab87a' }
  if (pct >=  -2)  return { bg:'rgba(255,255,255,0.03)', text:'#777' }
  if (pct >=  -8)  return { bg:'#e050501a', text:'#c07070' }
  if (pct >= -15)  return { bg:'#e0505033', text:'#e05050' }
  return               { bg:'#e0505055', text:'#e05050' }
}

const METRICS = ['1D','1M','1Y']

export default function AllStocksHeatmap({ allSectorData, onTickerClick }) {
  const [metric, setMetric] = useState('1Y')

  const getPct = (result) => {
    const closes = extractCloses(result)
    const n = closes.length
    const price = result?.meta?.regularMarketPrice
    const prev  = result?.meta?.chartPreviousClose || result?.meta?.previousClose
    if (metric === '1D') return pctChange(price, prev)
    if (metric === '1M') return n > 21 ? pctChange(closes[n-1], closes[n-22]) : n > 1 ? pctChange(closes[n-1], closes[0]) : null
    return n > 1 ? pctChange(closes[n-1], closes[0]) : null
  }

  return (
    <Panel title="All Sector Holdings" badge="77 stocks at a glance">
      {/* Controls row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        {/* Metric toggle */}
        <div style={{ display:'flex', gap:3 }}>
          {METRICS.map(m => (
            <button key={m} onClick={() => setMetric(m)} style={{
              fontSize:10, fontWeight: metric===m ? 700 : 400,
              padding:'3px 9px', borderRadius:5,
              background: metric===m ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: metric===m ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              color: metric===m ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor:'pointer',
            }}>{m}</button>
          ))}
        </div>

        {/* Sector color legend */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px' }}>
          {SECTORS.map(s => (
            <span key={s.id} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'var(--text-muted)' }}>
              <span style={{ width:8, height:8, borderRadius:2, background:s.color+'66', border:`1px solid ${s.color}`, display:'inline-block' }}/>
              {s.short}
            </span>
          ))}
        </div>
      </div>

      {/* Sector blocks — one rectangle per sector, all in a responsive grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 }}>
        {SECTORS.map(s => {
          const top7 = allSectorData?.[s.id] ?? []
          return (
            <div key={s.id} style={{
              border: `1px solid ${s.color}55`,
              borderTop: `2px solid ${s.color}`,
              borderRadius:8,
              padding:'7px 8px',
              background:'rgba(0,0,0,0.15)',
            }}>
              {/* Sector header */}
              <div style={{ fontSize:9, fontWeight:700, color:s.color, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:6 }}>
                {s.short}
              </div>
              {/* 7 stock cells */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0,1fr))', gap:2 }}>
                {s.top7.map((sym, i) => {
                  const result = top7[i]
                  const pct = getPct(result)
                  const { bg, text } = heatColor(pct)
                  return (
                    <div
                      key={sym}
                      onClick={() => result && onTickerClick?.(sym, result)}
                      title={`${sym}: ${pct != null ? (pct>=0?'+':'')+pct.toFixed(1)+'%' : '—'}`}
                      style={{
                        background: bg,
                        border: `0.5px solid ${s.color}33`,
                        borderRadius:4,
                        padding:'4px 2px',
                        textAlign:'center',
                        cursor: result ? 'pointer' : 'default',
                        transition:'opacity 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity='0.7'}
                      onMouseLeave={e => e.currentTarget.style.opacity='1'}
                    >
                      <div style={{ fontSize:8, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {sym.length > 5 ? sym.slice(0,4)+'…' : sym}
                      </div>
                      <div style={{ fontSize:8, fontWeight:600, color:text, lineHeight:1.3 }}>
                        {pct != null ? (pct>=0?'+':'')+pct.toFixed(1)+'%' : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Return legend */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:9, color:'var(--text-muted)', marginRight:2 }}>Return:</span>
        {[
          ['#e05050','< −15%'],
          ['#e05050','−8 to −15'],
          ['#c07070','−2 to −8'],
          ['#777','±2%'],
          ['#7ab87a','+2 to +8'],
          ['#1fb87a','+8 to +15'],
          ['#1fb87a','> +15%'],
        ].map(([c,l],i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:c }}>
            <span style={{ width:7, height:7, borderRadius:1, background:c+'44', border:`0.5px solid ${c}88`, display:'inline-block' }}/>
            {l}
          </span>
        ))}
      </div>
    </Panel>
  )
}
