import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import Panel from './Panel'
import RangeToggle from './RangeToggle'
import { fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip)

function getRaw(result) {
  return {
    closes: result?.indicators?.quote?.[0]?.close ?? [],
    ts:     result?.timestamp ?? [],
    price:  result?.meta?.regularMarketPrice,
    mcap:   result?.meta?.marketCap,
  }
}

export default function Top7McapPanel({ allRangeData, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const [activeRange, setActiveRange] = useState('1Y')
  const [status, setStatus]           = useState('')
  const syms = activeSector.top7

  const rangeData    = allRangeData?.[activeRange]
  const top7Results  = rangeData?.top7 ?? []

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!canvasRef.current) return

    // Parse each stock
    const stocks = top7Results.map((r, i) => {
      if (!r) return null
      const { closes, ts, price, mcap } = getRaw(r)
      if (!closes.length || !price || !mcap) return null
      const sharesOut = mcap / price
      // Build ts→close map for alignment
      const tsMap = {}
      ts.forEach((t, j) => { if (closes[j] != null) tsMap[t] = closes[j] })
      return { sym: syms[i], tsMap, sharesOut, mcap, color: TICKER_COLORS[i], closes, ts }
    })

    const valid = stocks.filter(Boolean)
    if (!valid.length) { setStatus('Waiting for stock data…'); return }

    // Use the stock with most timestamps as the x-axis spine
    const spine = valid.reduce((a, b) => b.ts.length > a.ts.length ? b : a)
    const spineTs = spine.ts

    // Sample up to 40 evenly spaced points
    const step = Math.max(1, Math.floor(spineTs.length / 40))
    const indices = []
    for (let i = 0; i < spineTs.length; i += step) indices.push(i)
    if (indices[indices.length - 1] !== spineTs.length - 1) indices.push(spineTs.length - 1)

    const labels = indices.map(i => {
      const d = new Date(spineTs[i] * 1000)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    // At each sampled timestamp, compute each stock's mcap, then express as % of sector total
    const datasets = stocks.map((s, idx) => {
      if (!s) return { label: syms[idx], data: Array(indices.length).fill(0), backgroundColor: 'transparent', stack: 'mcap', borderWidth: 0 }

      const data = indices.map(i => {
        const t = spineTs[i]
        // Find this stock's close nearest to t
        let close = s.tsMap[t]
        if (close == null) {
          const nearest = Object.keys(s.tsMap).map(Number)
            .filter(st => Math.abs(st - t) < 7 * 86400)
            .sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]
          close = nearest != null ? s.tsMap[nearest] : null
        }
        if (!close) return 0
        return close * s.sharesOut // raw mcap in dollars at this point
      })

      return { sym: s.sym, rawData: data, color: s.color, mcap: s.mcap }
    })

    // Now normalize each bar so values = % of sector total at that point
    const pctDatasets = datasets.map((d, idx) => {
      if (!d.sym) return { label: syms[idx], data: Array(indices.length).fill(0), backgroundColor: 'transparent', stack: 'mcap', borderWidth: 0 }

      const pctData = indices.map((_, i) => {
        const sectorTotal = datasets.reduce((sum, ds) => sum + (ds.rawData?.[i] ?? 0), 0)
        if (!sectorTotal) return 0
        return parseFloat(((d.rawData[i] / sectorTotal) * 100).toFixed(2))
      })

      return {
        label: d.sym,
        data: pctData,
        backgroundColor: d.color + 'cc',
        borderWidth: 0,
        stack: 'mcap',
      }
    })

    // Sanity check
    const firstTotal = pctDatasets.reduce((s, d) => s + (d.data[0] || 0), 0)
    setStatus(`${valid.length}/7 loaded · sector weights at latest bar`)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: pctDatasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y
                if (!v || v < 0.01) return null
                // Also show approx mcap
                const s = valid.find(x => x.sym === ctx.dataset.label)
                return ` ${ctx.dataset.label}: ${v.toFixed(1)}% of sector${s ? ' · ' + fmtMcap(s.mcap) : ''}`
              },
              footer: items => {
                const t = items.reduce((s, i) => s + (i.parsed.y || 0), 0)
                return t > 0 ? `Sector total shown: ${t.toFixed(1)}%` : null
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 } },
          y: { stacked: true, min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555', font: { size: 10 }, callback: v => v + '%' } },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [top7Results, activeSector, activeRange])

  return (
    <Panel title={`Top 7 ${activeSector.short} — Sector Weight`} badge="% of sector mcap">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <RangeToggle active={activeRange} onChange={r => setActiveRange(r.label)} color={activeSector.color} />
      </div>
      <div style={{ position: 'relative', width: '100%', height: 195 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 8 }}>
        {syms.map((sym, i) => {
          const r = top7Results[i]
          return (
            <span key={sym} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: TICKER_COLORS[i], display: 'inline-block' }} />
              {sym} {r?.meta?.marketCap ? fmtMcap(r.meta.marketCap) : '—'}
            </span>
          )
        })}
      </div>
      {status && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, opacity: 0.6 }}>{status}</div>}
    </Panel>
  )
}
