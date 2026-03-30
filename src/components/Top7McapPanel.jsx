import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip)

// SPY AUM / avg price ≈ total S&P 500 market cap proxy
// Instead of fixed shares, we compute dynamically from SPY's own mcap field if available,
// otherwise fall back to a ratio approach: stock mcap / (stock price / spy price * spy price * shares)
// Actually: simplest robust approach — normalize each stock's mcap to % of total
// using current mcap data, then apply that ratio across historical prices.

export default function Top7McapPanel({ top7Results, spyResult, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const syms = activeSector.top7
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!canvasRef.current) return

    // Validate inputs
    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (!spyResult || spyCloses.length < 2) {
      setStatus('Waiting for SPY data…')
      return
    }

    // Build stock info — only need closes and current mcap/price ratio
    const stocks = top7Results.map((r, i) => {
      if (!r) return null
      const closes = extractCloses(r)
      if (!closes.length) return null
      const price = r.meta?.regularMarketPrice
      const mcap = r.meta?.marketCap
      if (!price || !mcap || price === 0) return null
      return { sym: syms[i], closes, sharesOut: mcap / price, mcap, color: TICKER_COLORS[i] }
    })

    const validStocks = stocks.filter(Boolean)
    if (!validStocks.length) {
      setStatus('No stock data loaded yet')
      return
    }

    // SPY market cap proxy: use SPY AUM which is roughly price * 3.3B shares
    // But more reliable: use the ratio of stock mcap to SPY AUM at a single point,
    // then track how that ratio changes over time via price movements.
    const SPY_MULTIPLIER = 3_300_000_000

    // Verify we get non-zero values before building chart
    const testVal = validStocks[0].sharesOut * validStocks[0].closes[0]
    const testSpy = spyCloses[0] * SPY_MULTIPLIER
    const testPct = testVal / testSpy * 100
    console.log(`[McapPanel] ${activeSector.short}: ${validStocks.length} stocks, test% = ${testPct.toFixed(3)}`)

    if (testPct === 0 || !isFinite(testPct)) {
      setStatus(`Data error: test value = ${testPct}`)
      return
    }

    // Sample ~40 points evenly
    const step = Math.max(1, Math.floor(spyCloses.length / 40))
    const indices = []
    for (let i = 0; i < spyCloses.length; i += step) indices.push(i)
    if (indices[indices.length - 1] !== spyCloses.length - 1) indices.push(spyCloses.length - 1)

    const labels = indices.map(i => {
      if (!ts[i]) return ''
      return new Date(ts[i] * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    // Build datasets — include ALL 7 slots so colors stay consistent,
    // use zero-data for missing stocks so chart still renders
    const datasets = stocks.map((s, idx) => {
      if (!s) {
        return {
          label: syms[idx],
          data: Array(indices.length).fill(0),
          backgroundColor: 'rgba(0,0,0,0)',
          stack: 'mcap',
          borderWidth: 0,
          borderSkipped: true,
        }
      }
      const data = indices.map(i => {
        const ci = Math.min(i, s.closes.length - 1)
        const stockClose = s.closes[ci]
        const spyClose = spyCloses[i]
        if (!stockClose || !spyClose || spyClose === 0) return 0
        return parseFloat(((stockClose * s.sharesOut) / (spyClose * SPY_MULTIPLIER) * 100).toFixed(4))
      })
      return {
        label: s.sym,
        data,
        backgroundColor: s.color + 'cc',
        borderWidth: 0,
        stack: 'mcap',
      }
    })

    // Final check — sum first bar
    const firstBarTotal = datasets.reduce((sum, ds) => sum + (ds.data[0] || 0), 0)
    console.log(`[McapPanel] First bar total: ${firstBarTotal.toFixed(3)}%`)
    setStatus(`${validStocks.length}/7 stocks · ${firstBarTotal.toFixed(1)}% of S&P 500`)

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
                if (!v || v < 0.001) return null
                return ` ${ctx.dataset.label}: ${v.toFixed(2)}% of S&P 500`
              },
              footer: items => {
                const total = items.reduce((s, i) => s + (i.parsed.y || 0), 0)
                return total > 0.01 ? `Combined: ${total.toFixed(2)}%` : null
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

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
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
      {status && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, opacity: 0.6 }}>{status}</div>
      )}
    </Panel>
  )
}
