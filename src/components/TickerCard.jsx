import React, { useState, useRef, useEffect } from 'react'
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip } from 'chart.js'
import RangeToggle from './RangeToggle'
import { fmtPrice, fmtMcap, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

function Sparkline({ closes, color }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || closes.length < 2) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: closes.map((_,i) => i),
        datasets: [{ data: closes, borderColor: color, borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: color+'18', tension: 0.3 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend:{display:false}, tooltip:{enabled:false} },
        scales: { x:{display:false}, y:{display:false, min:Math.min(...closes)*0.995, max:Math.max(...closes)*1.005} },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [closes, color])
  return <div style={{ position:'relative', width:'100%', height:32 }}><canvas ref={canvasRef}/></div>
}

function WeekRange({ closes, price }) {
  if (!closes.length || !price) return null
  const high = Math.max(...closes)
  const low  = Math.min(...closes)
  if (high === low) return null
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
  const dotColor = pct > 75 ? '#1fb87a' : pct < 25 ? '#e05050' : '#e8a835'
  return (
    <div style={{ marginTop:5 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text-muted)', marginBottom:3 }}>
        <span>${low.toFixed(0)}</span>
        <span>52w</span>
        <span>${high.toFixed(0)}</span>
      </div>
      <div style={{ position:'relative', height:3, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
        <div style={{
          position:'absolute', top:-3, width:9, height:9,
          background: dotColor, borderRadius:'50%',
          left: `calc(${pct}% - 4px)`,
          boxShadow:`0 0 0 2px var(--bg-card), 0 0 0 3px ${dotColor}44`,
        }}/>
      </div>
    </div>
  )
}

export default function TickerCard({ allRangeResults, sym, isSP500=false, isFav=false, onToggleFav, onClick }) {
  const [activeRange, setActiveRange] = useState('1D')

  const result  = allRangeResults?.[activeRange] ?? null
  const result1Y = allRangeResults?.['1Y'] ?? null

  const meta   = result?.meta
  const price  = meta?.regularMarketPrice
  const prev   = meta?.chartPreviousClose || meta?.previousClose
  const pct    = pctChange(price, prev)
  const isUp   = (pct ?? 0) >= 0
  const chgColor = isUp ? 'var(--up)' : 'var(--dn)'

  const closes   = (result?.indicators?.quote?.[0]?.close ?? []).filter(v => v != null)
  const closes1Y = (result1Y?.indicators?.quote?.[0]?.close ?? []).filter(v => v != null)
  const sparkColor = isUp ? '#1fb87a' : '#e05050'
  const rangeChg = closes.length > 1 ? pctChange(closes[closes.length-1], closes[0]) : null

  return (
    <div
      onClick={result && !isSP500 ? onClick : undefined}
      style={{
        background:'var(--bg-card)', border:'0.5px solid var(--border)',
        borderLeft: isSP500 ? '3px solid var(--blue)' : undefined,
        borderRadius:'var(--radius)', padding:'10px 12px',
        display:'flex', flexDirection:'column', gap:2,
        position:'relative',
        cursor: result && !isSP500 ? 'pointer' : 'default',
        transition:'border-color 0.15s',
      }}
      onMouseEnter={e=>{ if(!isSP500) e.currentTarget.style.setProperty('border-color','rgba(255,255,255,0.2)') }}
      onMouseLeave={e=>{ if(!isSP500) e.currentTarget.style.removeProperty('border-color') }}
    >
      {!isSP500 && onToggleFav && (
        <button onClick={e=>{e.stopPropagation();onToggleFav(sym)}}
          style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',padding:2,fontSize:13,color:isFav?'#e05050':'var(--text-muted)',opacity:isFav?1:0.4,transition:'opacity 0.15s'}}
          onMouseEnter={e=>{e.stopPropagation();e.currentTarget.style.opacity='1'}}
          onMouseLeave={e=>{e.stopPropagation();e.currentTarget.style.opacity=isFav?'1':'0.4'}}
        >{isFav?'♥':'♡'}</button>
      )}

      <div style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',letterSpacing:'0.05em',textTransform:'uppercase',paddingRight:18}}>{sym}</div>

      {/* Range toggle — stop propagation so click doesn't open modal */}
      <div onClick={e=>e.stopPropagation()} style={{marginTop:2,marginBottom:2}}>
        <RangeToggle active={activeRange} onChange={r=>setActiveRange(r.label)} color={isSP500?'#4a8fd4':'#888892'}/>
      </div>

      {!result ? (
        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Loading…</div>
      ) : (
        <>
          <div style={{fontSize:17,fontWeight:500,color:'var(--text-primary)',marginTop:2}}>${fmtPrice(price)}</div>
          <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
            <div style={{fontSize:11,fontWeight:500,color:chgColor}}>{isUp?'+':''}{pct?.toFixed(2)}% today</div>
            {activeRange !== '1D' && rangeChg != null && (
              <div style={{fontSize:10,color:rangeChg>=0?'var(--up)':'var(--dn)'}}>
                {rangeChg>=0?'+':''}{rangeChg.toFixed(1)}% {activeRange}
              </div>
            )}
          </div>
          {!isSP500 && <div style={{fontSize:10,color:'var(--text-secondary)'}}>{fmtMcap(meta?.marketCap)}</div>}
          <div style={{marginTop:4}}><Sparkline closes={closes} color={sparkColor}/></div>
          {/* 52-week range bar — always from 1Y data */}
          {!isSP500 && closes1Y.length > 0 && <WeekRange closes={closes1Y} price={price}/>}
          {!isSP500 && <div style={{fontSize:9,color:'var(--text-muted)',textAlign:'center',opacity:0.5,marginTop:3}}>click to expand</div>}
        </>
      )}
    </div>
  )
}
