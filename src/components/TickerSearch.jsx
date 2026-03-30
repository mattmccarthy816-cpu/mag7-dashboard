import React, { useState, useRef, useEffect } from 'react'
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip, Filler } from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip, Filler)

function hexToRgba(hex, op) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${op})`
}

async function fetchTicker(sym, range='1y', interval='1d') {
  const res = await fetch(`/api/quote?symbols=${sym}&range=${range}&interval=${interval}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const result = data?.[0]?.data
  if (!result) throw new Error(`No data found for "${sym}"`)
  return result
}

function CompareChart({ stockResult, spyResult, sym, color }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const hoveredRef = useRef(null)

  const stockCloses = extractCloses(stockResult)
  const spyCloses = extractCloses(spyResult)
  const ts = extractTimestamps(spyResult)

  const stockYr = stockCloses.length > 1 ? pctChange(stockCloses[stockCloses.length-1], stockCloses[0]) : null
  const spyYr = spyCloses.length > 1 ? pctChange(spyCloses[spyCloses.length-1], spyCloses[0]) : null
  const diff = stockYr != null && spyYr != null ? stockYr - spyYr : null

  useEffect(() => {
    if (!canvasRef.current || stockCloses.length < 2 || spyCloses.length < 2) return
    if (chartRef.current) chartRef.current.destroy()

    const n = Math.min(stockCloses.length, spyCloses.length)
    const labels = ts.slice(0, n).map(t => new Date(t*1000).toLocaleDateString('en-US', { month:'short', day:'numeric' }))

    const datasets = [
      {
        label: sym,
        data: stockCloses.slice(0,n).map((v,i) => v && stockCloses[0] ? parseFloat(((v-stockCloses[0])/stockCloses[0]*100).toFixed(2)) : null),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0, fill: false, tension: 0.3, spanGaps: true,
        _color: color, _isSPY: false,
      },
      {
        label: 'SPY',
        data: spyCloses.slice(0,n).map((v,i) => v && spyCloses[0] ? parseFloat(((v-spyCloses[0])/spyCloses[0]*100).toFixed(2)) : null),
        borderColor: hexToRgba('#e0e0f0', 0.65),
        borderWidth: 2,
        borderDash: [6,3],
        pointRadius: 0, fill: false, tension: 0.3, spanGaps: true,
        _color: '#e0e0f0', _isSPY: true,
      },
    ]

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toFixed(2)}%` } },
        },
        scales: {
          x: { grid:{display:false}, ticks:{color:'#555', font:{size:10}, maxTicksLimit:10, maxRotation:0} },
          y: { grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#555', font:{size:10}, callback: v => (v>=0?'+':'')+v.toFixed(0)+'%'} },
        },
        onHover: (_evt, activeElements) => {
          if (!chartRef.current) return
          const evt = _evt.native
          if (!activeElements.length || !evt) {
            if (hoveredRef.current !== null) {
              hoveredRef.current = null
              chartRef.current.data.datasets.forEach((ds,i) => {
                ds.borderColor = i === 0 ? color : hexToRgba('#e0e0f0', 0.65)
                ds.borderWidth = 2
              })
              chartRef.current.update('none')
            }
            return
          }
          const rect = canvasRef.current.getBoundingClientRect()
          const mouseY = evt.clientY - rect.top
          let closest = null, minDist = Infinity
          activeElements.forEach(el => {
            const dist = Math.abs(el.element.y - mouseY)
            if (dist < minDist) { minDist = dist; closest = el.datasetIndex }
          })
          if (hoveredRef.current !== closest) {
            hoveredRef.current = closest
            chartRef.current.data.datasets.forEach((ds, i) => {
              if (i === closest) {
                ds.borderColor = hexToRgba(ds._color, 1)
                ds.borderWidth = 2.5
              } else {
                ds.borderColor = hexToRgba(ds._color, 0.15)
                ds.borderWidth = 1
              }
            })
            chartRef.current.update('none')
          }
        },
      },
    })

    const canvas = canvasRef.current
    const onLeave = () => {
      hoveredRef.current = null
      if (chartRef.current) {
        chartRef.current.data.datasets.forEach((ds, i) => {
          ds.borderColor = i === 0 ? color : hexToRgba('#e0e0f0', 0.65)
          ds.borderWidth = 2
        })
        chartRef.current.update('none')
      }
    }
    canvas.addEventListener('mouseleave', onLeave)
    return () => { canvas.removeEventListener('mouseleave', onLeave); if (chartRef.current) chartRef.current.destroy() }
  }, [stockResult, spyResult, sym, color])

  return (
    <div>
      {/* Stats row */}
      <div style={{ display:'flex', gap:20, marginBottom:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>1-year return</div>
          <div style={{ fontSize:16, fontWeight:600, color: (stockYr??0)>=0?'#1fb87a':'#e05050' }}>
            {stockYr != null ? ((stockYr>=0?'+':'')+stockYr.toFixed(1)+'%') : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>S&P 500 1yr</div>
          <div style={{ fontSize:16, fontWeight:600, color:'#e8e8f0' }}>
            {spyYr != null ? ((spyYr>=0?'+':'')+spyYr.toFixed(1)+'%') : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>vs market</div>
          <div style={{ fontSize:16, fontWeight:600, color: (diff??0)>=0?'#1fb87a':'#e05050' }}>
            {diff != null ? ((diff>=0?'+':'')+diff.toFixed(1)+'%') : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>current price</div>
          <div style={{ fontSize:16, fontWeight:600, color:'#e8e8f0' }}>
            ${stockResult?.meta?.regularMarketPrice?.toFixed(2) ?? '—'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginBottom:8 }}>
        {[{ label: sym, color, dash: false }, { label: 'SPY', color: '#e0e0f0', dash: true }].map(l => (
          <span key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#e8e8f0' }}>
            <svg width="20" height="10">
              <line x1="0" y1="5" x2="20" y2="5" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash?'6,3':undefined} />
            </svg>
            {l.label}
          </span>
        ))}
      </div>

      <div style={{ position:'relative', width:'100%', height:220 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

const CHART_COLORS = ['#4a8fd4','#1fb87a','#e8a835','#9b7de0','#d4507a','#4ab8b8','#e05050']

export default function TickerSearch({ spyResult }) {
  const [input, setInput] = useState('')
  const [searches, setSearches] = useState([]) // [{ sym, result, color, loading, error }]
  const inputRef = useRef(null)

  const handleSearch = async (rawSym) => {
    const sym = rawSym.trim().toUpperCase()
    if (!sym) return
    if (searches.find(s => s.sym === sym)) return // already shown

    const color = CHART_COLORS[searches.length % CHART_COLORS.length]
    setSearches(prev => [...prev, { sym, result: null, color, loading: true, error: null }])
    setInput('')

    try {
      const result = await fetchTicker(sym)
      setSearches(prev => prev.map(s => s.sym === sym ? { ...s, result, loading: false } : s))
    } catch (err) {
      setSearches(prev => prev.map(s => s.sym === sym ? { ...s, loading: false, error: err.message } : s))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch(input)
  }

  const handleRemove = (sym) => {
    setSearches(prev => prev.filter(s => s.sym !== sym))
  }

  return (
    <Panel title="Ticker Search" badge="vs S&P 500">
      {/* Search input */}
      <div style={{ display:'flex', gap:8, marginBottom:searches.length ? 20 : 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="Enter ticker, e.g. AAPL, TSLA, BRK-B…"
          style={{
            flex:1, fontSize:13, padding:'8px 12px',
            background:'var(--bg-secondary)',
            border:'0.5px solid var(--border-strong)',
            borderRadius:8,
            color:'var(--text-primary)',
            outline:'none',
          }}
        />
        <button
          onClick={() => handleSearch(input)}
          style={{
            fontSize:12, fontWeight:600, padding:'8px 16px',
            background:'var(--bg-secondary)',
            border:'0.5px solid var(--border-strong)',
            borderRadius:8, color:'var(--text-secondary)', cursor:'pointer',
          }}
        >
          Search
        </button>
      </div>

      {/* Results */}
      {searches.map((s, idx) => (
        <div key={s.sym} style={{
          borderTop: idx === 0 ? '0.5px solid var(--border)' : 'none',
          paddingTop: 16,
          marginTop: idx > 0 ? 0 : 0,
          borderBottom: '0.5px solid var(--border)',
          paddingBottom: 20,
          marginBottom: idx < searches.length - 1 ? 16 : 0,
        }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:10, height:10, borderRadius:3, background:s.color, display:'inline-block' }} />
              <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{s.sym}</span>
              {s.result && (
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {s.result.meta?.longName || s.result.meta?.shortName || ''}
                </span>
              )}
            </div>
            <button
              onClick={() => handleRemove(s.sym)}
              style={{ fontSize:13, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'2px 6px', borderRadius:4 }}
            >
              ✕
            </button>
          </div>

          {s.loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[100,80,60].map((w,i) => (
                <div key={i} style={{ height:10, borderRadius:4, width:w+'%', background:'var(--bg-secondary)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:i*0.15+'s' }} />
              ))}
            </div>
          )}

          {s.error && (
            <div style={{ fontSize:12, color:'#e05050', background:'rgba(224,80,80,0.08)', padding:'8px 10px', borderRadius:6 }}>
              {s.error}
            </div>
          )}

          {s.result && spyResult && !s.loading && (
            <CompareChart stockResult={s.result} spyResult={spyResult} sym={s.sym} color={s.color} />
          )}

          {s.result && !spyResult && (
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Waiting for S&P 500 data…</div>
          )}
        </div>
      ))}

      {searches.length === 0 && (
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:10, lineHeight:1.6 }}>
          Search any US stock ticker to compare its 1-year performance against the S&P 500.
          Multiple tickers can be searched and compared simultaneously.
        </div>
      )}
    </Panel>
  )
}
