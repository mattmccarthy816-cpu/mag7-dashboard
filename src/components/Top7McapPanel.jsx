import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

// Approximate S&P 500 total market cap from SPY (SPY tracks ~$43T market)
// SPY price * shares outstanding (~3.3B) gives rough index mcap
const SPY_SHARES = 3_300_000_000

export default function Top7McapPanel({ top7Results, spyResult, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const syms = activeSector.top7

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (!spyCloses.length) return

    // Build datasets: each stock's market cap share of S&P 500 over time
    // We use closing price * shares outstanding approximated from current mcap/price ratio
    const stockDatasets = top7Results.map((result, i) => {
      if (!result) return null
      const closes = extractCloses(result)
      const meta = result.meta
      const currentPrice = meta.regularMarketPrice
      const mcap = meta.marketCap
      if (!currentPrice || !mcap) return null
      const sharesOut = mcap / currentPrice

      const n = Math.min(closes.length, spyCloses.length)
      const data = []
      for (let j = 0; j < n; j++) {
        if (closes[j] && spyCloses[j]) {
          const stockMcap = closes[j] * sharesOut
          const spyMcap = spyCloses[j] * SPY_SHARES
          data.push(parseFloat((stockMcap / spyMcap * 100).toFixed(3)))
        } else {
          data.push(null)
        }
      }
      return {
        label: syms[i],
        data,
        borderColor: TICKER_COLORS[i],
        backgroundColor: TICKER_COLORS[i] + '55',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: i === 0 ? 'origin' : '-1',
        tension: 0.3,
      }
    }).filter(Boolean)

    if (!stockDatasets.length) return

    const n = Math.min(...stockDatasets.map(d => d.data.length), spyCloses.length)
    const labels = []
    for (let j = 0; j < n; j++) {
      const d = new Date((ts[j] || 0) * 1000)
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets: stockDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}% of S&P 500`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            stacked: true,
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

  // Current mcap totals for legend
  const validResults = top7Results.filter(Boolean)

  return (
    <Panel title={`Top 7 ${activeSector.short} — Share of S&P 500`} badge="stacked · 1 year">
      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px 12px',
        marginTop: 10,
      }}>
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
