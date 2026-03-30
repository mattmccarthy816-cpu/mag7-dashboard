import React, { useEffect, useRef } from 'react'
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip } from 'chart.js'
import { extractCloses, extractTimestamps, fmtPrice, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

function hexToRgba(hex, op) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${op})`
}

function applyHover(chart, hovIdx) {
  chart.data.datasets.forEach((ds, i) => {
    if (hovIdx === null) {
      ds.borderColor = hexToRgba(ds._color, ds._isSPY ? 0.75 : 0.5)
      ds.borderWidth = ds._isSPY ? 2 : 1.5
    } else if (i === hovIdx) {
      ds.borderColor = hexToRgba(ds._color, 1)
      ds.borderWidth = 3
    } else {
      ds.borderColor = hexToRgba(ds._color, 0.12)
      ds.borderWidth = 0.8
    }
  })
  chart.update('none')
}

function StockChart({ result }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const closes = extractCloses(result)
  const ts = extractTimestamps(result)
  const price = result?.meta?.regularMarketPrice
  const prev = result?.meta?.chartPreviousClose || result?.meta?.previousClose
  const pct = pctChange(price, prev)
  const yrPct = closes.length > 1 ? pctChange(price, closes[0]) : null
  const isUp = (pct??0) >= 0
  const color = isUp ? '#1fb87a' : '#e05050'

  useEffect(() => {
    if (!canvasRef.current || closes.length < 2) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: ts.map(t => new Date(t*1000).toLocaleDateString('en-US', { month:'short', day:'numeric' })),
        datasets: [{ data: closes, borderColor: color, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: hexToRgba(color, 0.08), tension: 0.3 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` $${ctx.parsed.y.toFixed(2)}` } } },
        scales: {
          x: { grid:{display:false}, ticks:{color:'#888', font:{size:11}, maxTicksLimit:10, maxRotation:0} },
          y: { grid:{color:'rgba(255,255,255,0.06)'}, ticks:{color:'#888', font:{size:11}, callback: v => '$'+v.toFixed(0)} },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [result])

  const sign = (pct??0) >= 0 ? '+' : ''
  return (
    <div>
      <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:16 }}>
        <div style={{ fontSize:28, fontWeight:600, color:'#f0f0f2' }}>${fmtPrice(price)}</div>
        <div style={{ fontSize:14, fontWeight:500, color }}>{sign}{pct?.toFixed(2)}% today</div>
        {yrPct != null && <div style={{ fontSize:12, color: yrPct>=0?'#1fb87a':'#e05050' }}>{yrPct>=0?'+':''}{yrPct.toFixed(1)}% 1yr</div>}
      </div>
      <div style={{ position:'relative', width:'100%', height:300 }}><canvas ref={canvasRef} /></div>
    </div>
  )
}

function EtfChart({ sectorResult, relatedResults, spyResult, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const hoveredRef = useRef(null)

  const etfConfigs = [
    { label: activeSector.etf, result: sectorResult, color: activeSector.color, dash: [] },
    ...activeSector.relatedEtfs.map((etf, i) => ({ label: etf, result: relatedResults?.[i]??null, color: activeSector.color, dash: [] })),
    { label: 'SPY', result: spyResult, color: '#e0e0f0', dash: [6,3] },
  ]

  useEffect(() => {
    if (!spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (spyCloses.length < 2) return
    const n = spyCloses.length
    const labels = ts.map(t => new Date(t*1000).toLocaleDateString('en-US', { month:'short', day:'numeric' }))

    const datasets = etfConfigs.map(({ label, result, color, dash }) => {
      const closes = result ? extractCloses(result) : []
      const base = closes[0]
      const data = Array(n).fill(null)
      for (let i = 0; i < Math.min(closes.length, n); i++) {
        if (closes[i] && base) data[i] = parseFloat(((closes[i]-base)/base*100).toFixed(2))
      }
      const isSPY = label === 'SPY'
      return { label, data, borderColor: hexToRgba(color, isSPY?0.75:0.5), borderWidth: isSPY?2:1.5, borderDash: dash, pointRadius:0, fill:false, tension:0.3, spanGaps:true, _color:color, _isSPY:isSPY }
    })

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y==null?null:` ${ctx.dataset.label}: ${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toFixed(2)}%` } },
        },
        scales: {
          x: { grid:{display:false}, ticks:{color:'#888', font:{size:11}, maxTicksLimit:12, maxRotation:0} },
          y: { grid:{color:'rgba(255,255,255,0.06)'}, ticks:{color:'#888', font:{size:11}, callback: v => (v>=0?'+':'')+v.toFixed(0)+'%'} },
        },
        onHover: (_evt, activeElements) => {
          if (!chartRef.current) return
          const evt = _evt.native
          if (!activeElements.length || !evt) {
            if (hoveredRef.current !== null) { hoveredRef.current = null; applyHover(chartRef.current, null) }
            return
          }
          const rect = canvasRef.current.getBoundingClientRect()
          const mouseY = evt.clientY - rect.top
          let closest = null, minDist = Infinity
          activeElements.forEach(el => {
            const dist = Math.abs(el.element.y - mouseY)
            if (dist < minDist) { minDist = dist; closest = el.datasetIndex }
          })
          if (hoveredRef.current !== closest) { hoveredRef.current = closest; applyHover(chartRef.current, closest) }
        },
      },
    })

    const canvas = canvasRef.current
    const onLeave = () => { hoveredRef.current = null; if (chartRef.current) applyHover(chartRef.current, null) }
    canvas.addEventListener('mouseleave', onLeave)
    return () => { canvas.removeEventListener('mouseleave', onLeave); if (chartRef.current) chartRef.current.destroy() }
  }, [sectorResult, relatedResults, spyResult, activeSector])

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', marginBottom:14 }}>
        {etfConfigs.map(({ label, color, dash }) => {
          const isSPY = label === 'SPY'
          return (
            <span key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#e8e8f0' }}>
              <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5"
                stroke={hexToRgba(color, isSPY?0.85:0.6)} strokeWidth={isSPY?2:1.5}
                strokeDasharray={dash?.length?'6,3':undefined}
              /></svg>
              {label}
            </span>
          )
        })}
      </div>
      <div style={{ position:'relative', width:'100%', height:340 }}><canvas ref={canvasRef} /></div>
      <div style={{ fontSize:11, color:'#555', marginTop:10 }}>Hover to highlight · 1-year % return from start</div>
    </div>
  )
}

export default function ChartModal({ config, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key==='Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const title = config.type === 'stock' ? config.sym : `${config.activeSector.short} ETF Comparison`

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#16161a', border:'0.5px solid rgba(255,255,255,0.14)', borderRadius:14, padding:'22px 26px', width:'100%', maxWidth:800 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:17, fontWeight:600, color:'#f0f0f2' }}>{title}</div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:8, width:30, height:30, color:'#aaa', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        {config.type === 'stock' && <StockChart result={config.result} sym={config.sym} />}
        {config.type === 'etf'   && <EtfChart {...config} />}
        <div style={{ fontSize:10, color:'#444', marginTop:14, textAlign:'right' }}>Click outside or Esc to close</div>
      </div>
    </div>
  )
}
