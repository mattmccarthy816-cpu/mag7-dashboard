import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip)

const SPY_SHARES = 3_300_000_000

export default function Top7McapPanel({ top7Results, spyResult, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const syms = activeSector.top7
  const [debugMsg, setDebugMsg] = useState('')

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!canvasRef.current) return

    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)

    if (!spyResult) { setDebugMsg('No SPY data'); return }
    if (spyCloses.length < 2) { setDebugMsg(`SPY closes: ${spyCloses.length}`); return }

    // How many stocks have usable data?
    const stockInfo = top7Results.map((r, i) => {
      if (!r) return { sym: syms[i], ok: false, reason: 'null result' }
      const closes = extractCloses(r)
      const price = r.meta?.regularMarketPrice
      const mcap = r.meta?.marketCap
      if (!closes.length) return { sym: syms[i], ok: false, reason: 'no closes' }
      if (!price) return { sym: syms[i], ok: false, reason: 'no price' }
      if (!mcap) return { sym: syms[i], ok: false, reason: 'no mcap' }
      return { sym: syms[i], ok: true, closes, shares: mcap / price, mcap }
    })

    const good = stockInfo.filter(s => s.ok)
    if (!good.length) {
      setDebugMsg(`No stock data. Stocks: ${stockInfo.map(s=>s.sym+':'+s.reason).join(', ')}`)
      return
    }
    setDebugMsg(`${good.length}/7 stocks loaded`)

    // Sample ~36 evenly spaced points
    const step = Math.max(1, Math.floor(spyCloses.length / 36))
    const indices = []
    for (let i = 0; i < spyCloses.length; i += step) indices.push(i)
    if (indices[indices.length-1] !== spyCloses.length-1) indices.push(spyCloses.length-1)

    const labels = indices.map(i => {
      if (!ts[i]) return ''
      return new Date(ts[i]*1000).toLocaleDateString('en-US', { month:'short', day:'numeric' })
    })

    const datasets = stockInfo.map((s, idx) => {
      if (!s.ok) {
        return { label: syms[idx], data: Array(indices.length).fill(0), backgroundColor: 'transparent', stack: 'mcap', borderWidth: 0 }
      }
      const data = indices.map(i => {
        // Use closest available close for this stock
        const ci = Math.min(i, s.closes.length - 1)
        const sc = s.closes[ci]
        const spy = spyCloses[i]
        if (!sc || !spy || spy === 0) return 0
        return parseFloat(((sc * s.shares) / (spy * SPY_SHARES) * 100).toFixed(3))
      })
      return {
        label: s.sym,
        data,
        backgroundColor: TICKER_COLORS[idx] + 'bb',
        borderColor: TICKER_COLORS[idx],
        borderWidth: 0,
        stack: 'mcap',
      }
    })

    // Sanity check — log first/last values
    const visibleDatasets = datasets.filter(d => d.backgroundColor !== 'transparent')
    console.log(`[McapPanel] ${activeSector.short}: ${visibleDatasets.length} datasets, sample value:`, visibleDatasets[0]?.data?.[0])

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y
                if (!v || v < 0.001) return null
                return ` ${ctx.dataset.label}: ${v.toFixed(2)}% of S&P 500`
              },
              footer: items => {
                const total = items.reduce((s, i) => s + (i.parsed.y||0), 0)
                return total > 0 ? `Combined: ${total.toFixed(2)}%` : null
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color:'#555', font:{size:10}, maxTicksLimit:8, maxRotation:0 } },
          y: { stacked: true, grid: { color:'rgba(255,255,255,0.05)' }, ticks: { color:'#555', font:{size:10}, callback: v => v.toFixed(1)+'%' } },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [top7Results, spyResult, activeSector])

  return (
    <Panel title={`Top 7 ${activeSector.short} — Share of S&P 500`} badge="stacked · 1 year">
      <div style={{ position:'relative', width:'100%', height:210 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 12px', marginTop:10 }}>
        {syms.map((sym, i) => {
          const r = top7Results[i]
          return (
            <span key={sym} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text-secondary)' }}>
              <span style={{ width:7, height:7, borderRadius:2, background:TICKER_COLORS[i], display:'inline-block' }} />
              {sym} {r?.meta?.marketCap ? fmtMcap(r.meta.marketCap) : '—'}
            </span>
          )
        })}
      </div>
      {debugMsg && (
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6, opacity:0.7 }}>{debugMsg}</div>
      )}
    </Panel>
  )
}
