import React, { useEffect, useRef } from 'react'
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

  useEffect(() => {
    if (!spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (spyCloses.length < 2) return

    // Sample ~40 evenly spaced points across the year for readable bars
    const step = Math.max(1, Math.floor(spyCloses.length / 40))
    const indices = []
    for (let i = 0; i < spyCloses.length; i += step) indices.push(i)
    if (indices[indices.length - 1] !== spyCloses.length - 1) indices.push(spyCloses.length - 1)

    const labels = indices.map(i => {
      if (!ts[i]) return ''
      const d = new Date(ts[i] * 1000)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    // Each stock's % share of S&P 500 mcap at each sampled point
    const validStocks = top7Results.map((result, idx) => {
      if (!result) return null
      const closes = extractCloses(result)
      if (!closes.length) return null
      const price = result.meta?.regularMarketPrice
      const mcap = result.meta?.marketCap
      if (!price || !mcap) return null
      const shares = mcap / price

      const data = indices.map(i => {
        const sc = closes[Math.min(i, closes.length - 1)]
        const spy = spyCloses[i]
        if (!sc || !spy) return 0
        return parseFloat(((sc * shares) / (spy * SPY_SHARES) * 100).toFixed(3))
      })

      return { sym: syms[idx], data, color: TICKER_COLORS[idx], mcap }
    })

    const datasets = validStocks.map((s, i) => {
      if (!s) {
        // empty placeholder so colors stay aligned
        return {
          label: syms[i],
          data: Array(labels.length).fill(0),
          backgroundColor: 'transparent',
          stack: 'mcap',
        }
      }
      return {
        label: s.sym,
        data: s.data,
        backgroundColor: s.color + 'cc',
        borderColor: s.color,
        borderWidth: 0,
        stack: 'mcap',
      }
    })

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y
                if (!v) return null
                return ` ${ctx.dataset.label}: ${v.toFixed(2)}% of S&P 500`
              },
              footer: items => {
                const total = items.reduce((s, i) => s + (i.parsed.y || 0), 0)
                return `Combined: ${total.toFixed(2)}%`
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#555', font: { size: 10 }, callback: v => v.toFixed(1) + '%' },
          },
        },
      },
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [top7Results, spyResult, activeSector])

  return (
    <Panel title={`Top 7 ${activeSector.short} — Share of S&P 500`} badge="stacked · 1 year">
      <div style={{ position: 'relative', width: '100%', height: 210 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 10 }}>
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
    </Panel>
  )
}
