import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  BarElement, BarController, CategoryScale, LinearScale,
  Filler, Tooltip, Legend,
} from 'chart.js'
import { extractCloses, extractTimestamps, fmtPrice, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, BarElement, BarController, CategoryScale, LinearScale, Filler, Tooltip, Legend)

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

// Stock detail modal
function StockChart({ result, sym, onClose }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const closes = extractCloses(result)
  const ts = extractTimestamps(result)
  const price = result?.meta?.regularMarketPrice
  const prev = result?.meta?.chartPreviousClose || result?.meta?.previousClose
  const pct = pctChange(price, prev)
  const yrPct = closes.length > 1 ? pctChange(price, closes[0]) : null
  const isUp = (pct ?? 0) >= 0
  const color = isUp ? '#1fb87a' : '#e05050'

  useEffect(() => {
    if (!canvasRef.current || closes.length < 2) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = ts.map(t => {
      const d = new Date(t * 1000)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: closes,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: hexToRgba(color === '#1fb87a' ? '#1fb87a' : '#e05050', 0.08),
          tension: 0.3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` $${ctx.parsed.y.toFixed(2)}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 11 }, maxTicksLimit: 10, maxRotation: 0 } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#666', font: { size: 11 }, callback: v => '$' + v.toFixed(0) } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [result])

  const sign = (pct ?? 0) >= 0 ? '+' : ''

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}>${fmtPrice(price)}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color }}>{sign}{pct?.toFixed(2)}% today</div>
        {yrPct != null && (
          <div style={{ fontSize: 12, color: yrPct >= 0 ? '#1fb87a' : '#e05050' }}>
            {yrPct >= 0 ? '+' : ''}{yrPct.toFixed(1)}% 1yr
          </div>
        )}
      </div>
      <div style={{ position: 'relative', width: '100%', height: 280 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

// ETF comparison modal
function EtfChart({ sectorResult, relatedResults, spyResult, activeSector, onClose }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const etfConfigs = [
    { label: activeSector.etf, result: sectorResult, color: activeSector.color },
    ...activeSector.relatedEtfs.map((etf, i) => ({ label: etf, result: relatedResults?.[i] ?? null, color: activeSector.color })),
    { label: 'SPY', result: spyResult, color: '#c8c8d8', dash: [6,3] },
  ]

  useEffect(() => {
    if (!spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (spyCloses.length < 2) return

    const n = spyCloses.length
    const labels = ts.map(t => new Date(t*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

    const datasets = etfConfigs.map(({ label, result, color, dash }) => {
      const closes = result ? extractCloses(result) : []
      const base = closes[0]
      const data = Array(n).fill(null)
      for (let i = 0; i < Math.min(closes.length, n); i++) {
        if (closes[i] && base) data[i] = parseFloat(((closes[i]-base)/base*100).toFixed(2))
      }
      const isSPY = label === 'SPY'
      return {
        label,
        data,
        borderColor: hexToRgba(color, isSPY ? 0.9 : 0.65),
        borderWidth: isSPY ? 2 : 1.5,
        borderDash: dash ?? [],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        spanGaps: true,
      }
    })

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#888', font: { size: 11 }, boxWidth: 20, padding: 14 } },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 11 }, maxTicksLimit: 12, maxRotation: 0 } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#666', font: { size: 11 }, callback: v => (v>=0?'+':'')+v.toFixed(0)+'%' } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [sectorResult, relatedResults, spyResult, activeSector])

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        1-year % return · {activeSector.etf}, {activeSector.relatedEtfs.join(', ')} vs SPY
      </div>
      <div style={{ position: 'relative', width: '100%', height: 320 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

export default function ChartModal({ config, onClose }) {
  // config: { type: 'stock', sym, result } | { type: 'etf', ...etfProps }
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const title = config.type === 'stock' ? config.sym : `${config.activeSector.short} ETF Comparison`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#18181c',
          border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: 14,
          padding: '20px 24px',
          width: '100%',
          maxWidth: 760,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)', border: 'none',
              borderRadius: 8, width: 28, height: 28,
              color: 'var(--text-secondary)', fontSize: 16,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {config.type === 'stock' && <StockChart result={config.result} sym={config.sym} onClose={onClose} />}
        {config.type === 'etf'   && <EtfChart {...config} onClose={onClose} />}

        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 14, textAlign: 'right' }}>
          Click outside or press Esc to close
        </div>
      </div>
    </div>
  )
}
