import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

// SPY shares outstanding — used to estimate S&P 500 total market cap from price
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

    const n = spyCloses.length

    // Build one series per stock: % of estimated S&P 500 mcap at each point
    const stockSeries = top7Results.map((result, i) => {
      if (!result) return null
      const closes = extractCloses(result)
      if (!closes.length) return null
      const meta = result.meta
      const currentPrice = meta.regularMarketPrice
      const mcap = meta.marketCap
      if (!currentPrice || !mcap) return null
      const sharesOut = mcap / currentPrice

      const data = []
      const m = Math.min(closes.length, n)
      for (let j = 0; j < m; j++) {
        if (closes[j] && spyCloses[j]) {
          const stockMcap = closes[j] * sharesOut
          const spyMcap = spyCloses[j] * SPY_SHARES
          data.push(parseFloat((stockMcap / spyMcap * 100).toFixed(3)))
        } else {
          data.push(null)
        }
      }
      // pad to length n if stock has fewer data points
      while (data.length < n) data.unshift(null)

      return { sym: syms[i], data, color: TICKER_COLORS[i] }
    }).filter(Boolean)

    if (!stockSeries.length) return

    const labels = spyCloses.map((_, j) => {
      if (!ts[j]) return ''
      const d = new Date(ts[j] * 1000)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    // Build stacked datasets — each dataset fills from the previous cumulative line
    // We do this by computing cumulative sums and filling between them
    const cumulativeData = stockSeries.map((_, si) => {
      return labels.map((_, li) => {
        let sum = 0
        for (let k = 0; k <= si; k++) {
          sum += stockSeries[k].data[li] ?? 0
        }
        return parseFloat(sum.toFixed(3))
      })
    })

    const datasets = stockSeries.map((s, si) => ({
      label: s.sym,
      data: cumulativeData[si],
      borderColor: s.color,
      backgroundColor: s.color + '66',
      borderWidth: 1,
      pointRadius: 0,
      fill: si === 0 ? 'origin' : { value: 0, target: si - 1 },
      tension: 0.3,
      spanGaps: true,
      // fill between this line and the previous cumulative line
      ...(si > 0 ? { fill: { above: s.color + '55', target: si - 1 } } : { fill: { above: s.color + '55', target: 'origin' } }),
    }))

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
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
                // Show individual (non-cumulative) share
                const si = stockSeries.findIndex(s => s.sym === ctx.dataset.label)
                if (si < 0) return null
                const indiv = si === 0
                  ? ctx.parsed.y
                  : ctx.parsed.y - (cumulativeData[si - 1][ctx.dataIndex] ?? 0)
                return ` ${ctx.dataset.label}: ${indiv.toFixed(2)}% of S&P 500`
              },
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
