import React, { useEffect, useRef } from 'react'
import {
  Chart, BarElement, BarController, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip, Legend)

const SPY_SHARES = 3_300_000_000
const SAMPLE_EVERY = 5 // take every Nth data point to keep bar chart readable

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

    // Sample indices evenly across the year
    const indices = []
    for (let i = 0; i < spyCloses.length; i += SAMPLE_EVERY) indices.push(i)
    if (indices[indices.length - 1] !== spyCloses.length - 1) {
      indices.push(spyCloses.length - 1)
    }

    const labels = indices.map(i => {
      if (!ts[i]) return ''
      const d = new Date(ts[i] * 1000)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    // Build per-stock datasets — each stock's % of S&P 500 mcap at sampled points
    const datasets = top7Results.map((result, idx) => {
      if (!result) return null
      const closes = extractCloses(result)
      if (!closes.length) return null
      const meta = result.meta
      const currentPrice = meta.regularMarketPrice
      const mcap = meta.marketCap
      if (!currentPrice || !mcap) return null
      const sharesOut = mcap / currentPrice

      const data = indices.map(i => {
        const stockClose = closes[i] ?? closes[closes.length - 1]
        const spyClose = spyCloses[i]
        if (!stockClose || !spyClose) return 0
        return parseFloat(((stockClose * sharesOut) / (spyClose * SPY_SHARES) * 100).toFixed(3))
      })

      return {
        label: syms[idx],
        data,
        backgroundColor: TICKER_COLORS[idx] + 'cc',
        borderColor: TICKER_COLORS[idx],
        borderWidth: 0,
        stack: 'mcap',
      }
    }).filter(Boolean)

    if (!datasets.length) return

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
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}% of S&P 500`,
              footer: items => {
                const total = items.reduce((s, i) => s + i.parsed.y, 0)
                return `Total: ${total.toFixed(2)}%`
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
            ticks: {
              color: '#555',
              font: { size: 10 },
              callback: v => v.toFixed(1) + '%',
            },
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
          const mcap = r?.meta?.marketCap
          return (
            <span key={sym} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'var(--text-secondary)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: 2,
                background: TICKER_COLORS[i], display: 'inline-block',
              }} />
              {sym} {mcap ? fmtMcap(mcap) : '—'}
            </span>
          )
        })}
      </div>
    </Panel>
  )
}
