import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import Panel from './Panel'
import RangeToggle from './RangeToggle'
import { fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip)

function getRaw(result) {
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const ts     = result?.timestamp ?? []
  const price  = result?.meta?.regularMarketPrice
  const mcap   = result?.meta?.marketCap
  return { closes, ts, price, mcap }
}

export default function Top7McapPanel({ allRangeData, activeSector }) {
  const canvasRef    = useRef(null)
  const chartRef     = useRef(null)
  const [activeRange, setActiveRange] = useState('1Y')
  const [status, setStatus]           = useState('Waiting for data…')
  const syms = activeSector.top7

  // Pull top7 directly from whichever range is selected
  const top7Results = allRangeData?.[activeRange]?.top7 ?? []

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!canvasRef.current) return

    // Collect valid stocks
    const stocks = top7Results.map((r, i) => {
      if (!r) return null
      const { closes, ts, price, mcap } = getRaw(r)
      if (!closes.length || !price || !mcap) return null
      const sharesOut = mcap / price
      const tsMap = {}
      ts.forEach((t, j) => { if (closes[j] != null) tsMap[t] = closes[j] })
      return { sym: syms[i], closes, ts, tsMap, sharesOut, mcap, color: TICKER_COLORS[i] }
    })

    const valid = stocks.filter(Boolean)

    if (!valid.length) {
      setStatus(`No data yet for ${activeRange} — try refreshing`)
      return
    }

    // Use longest ts array as spine
    const spine = valid.reduce((a, b) => b.ts.length > a.ts.length ? b : a)
    const spineTs = spine.ts.filter(t => t != null)

    if (spineTs.length < 2) { setStatus('Insufficient timestamps'); return }

    // Sample up to 40 points
    const step = Math.max(1, Math.floor(spineTs.length / 40))
    const indices = []
    for (let i = 0; i < spineTs.length; i += step) indices.push(i)
    if (indices[indices.length-1] !== spineTs.length-1) indices.push(spineTs.length-1)

    const labels = indices.map(i =>
      new Date(spineTs[i]*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})
    )

    // Compute raw mcap at each point for each stock
    const rawMcaps = stocks.map(s => {
      if (!s) return Array(indices.length).fill(0)
      return indices.map(i => {
        const t = spineTs[i]
        let close = s.tsMap[t]
        if (close == null) {
          // nearest within 7 days
          const nearby = Object.keys(s.tsMap).map(Number)
            .filter(st => Math.abs(st-t) < 604800)
            .sort((a,b) => Math.abs(a-t)-Math.abs(b-t))
          close = nearby.length ? s.tsMap[nearby[0]] : null
        }
        return close ? close * s.sharesOut : 0
      })
    })

    // Convert to % of sector total at each point
    const pctData = rawMcaps.map((raw, si) => {
      if (!stocks[si]) return Array(indices.length).fill(0)
      return raw.map((v, i) => {
        const total = rawMcaps.reduce((sum, arr) => sum + (arr[i]||0), 0)
        return total > 0 ? parseFloat((v/total*100).toFixed(2)) : 0
      })
    })

    // Log sanity check
    const lastBar = pctData.map(d => d[d.length-1]||0)
    const lastTotal = lastBar.reduce((a,b)=>a+b,0)
    console.log('[Mcap] latest bar:', syms.map((s,i)=>`${s}:${lastBar[i]?.toFixed(1)}%`).join(', '), `total:${lastTotal.toFixed(1)}%`)
    setStatus(`${valid.length}/7 stocks · ${lastTotal.toFixed(0)}% of sector accounted for`)

    const datasets = stocks.map((s, i) => ({
      label:           s ? s.sym : syms[i],
      data:            pctData[i],
      backgroundColor: s ? s.color + 'cc' : 'transparent',
      borderWidth:     0,
      stack:           'mcap',
    }))

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { display:false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y
                if (!v || v < 0.1) return null
                const s = valid.find(x => x.sym === ctx.dataset.label)
                return ` ${ctx.dataset.label}: ${v.toFixed(1)}%${s?' · '+fmtMcap(s.mcap):''}`
              },
              footer: items => {
                const t = items.reduce((s,i)=>s+(i.parsed.y||0),0)
                return t > 0 ? `Sector total: ${t.toFixed(1)}%` : null
              },
            },
          },
        },
        scales: {
          x: { stacked:true, grid:{display:false}, ticks:{color:'#555',font:{size:10},maxTicksLimit:8,maxRotation:0} },
          y: { stacked:true, min:0, max:100, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#555',font:{size:10},callback:v=>v+'%'} },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current=null } }
  }, [top7Results, activeSector, activeRange])

  return (
    <Panel title={`Top 7 ${activeSector.short} — Sector Weight`} badge="% of sector mcap">
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
        <RangeToggle active={activeRange} onChange={r=>setActiveRange(r.label)} color={activeSector.color}/>
      </div>
      <div style={{position:'relative',width:'100%',height:195}}>
        <canvas ref={canvasRef}/>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'5px 12px',marginTop:8}}>
        {syms.map((sym,i) => {
          const r = top7Results[i]
          return (
            <span key={sym} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-secondary)'}}>
              <span style={{width:7,height:7,borderRadius:2,background:TICKER_COLORS[i],display:'inline-block'}}/>
              {sym} {r?.meta?.marketCap ? fmtMcap(r.meta.marketCap) : '—'}
            </span>
          )
        })}
      </div>
      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:5,opacity:0.65}}>{status}</div>
    </Panel>
  )
}
