import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

export default function SectorVsMarketPanel({ sectorResult, relatedResults, spyResult, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  // Primary ETF: full opacity, 2.5px
  // Related ETFs: 40% opacity, 1.5px
  // SPY: dashed, muted gray
  const allEtfs = [
    { label: activeSector.etf, result: sectorResult, color: activeSector.color, width: 2.5, opacity: 1, dash: [] },
    ...activeSector.relatedEtfs.map((etf, i) => ({
      label: etf,
      result: relatedResults?.[i] ?? null,
      color: activeSector.color,
      width: 1.5,
      opacity: 0.35,
      dash: [],
    })),
    { label: 'SPY', result: spyResult, color: '#888892', width: 1.5, opacity: 0.7, dash: [5, 4] },
  ]

  useEffect(() => {
    if (!spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (spyCloses.length < 2) return

    const n = spyCloses.length
    const labels = ts.map(t => {
      const d = new Date(t * 1000)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    const datasets = allEtfs.map(({ label, result, color, width, opacity, dash }) => {
      const closes = result ? extractCloses(result) : []
      const base = closes[0]
      const data = Array(n).fill(null)
      const m = Math.min(closes.length, n)
      for (let i = 0; i < m; i++) {
        if (closes[i] && base) {
          data[i] = parseFloat(((closes[i] - base) / base * 100).toFixed(2))
        }
      }
      // Convert hex color + opacity to rgba
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      const rgba = `rgba(${r},${g},${b},${opacity})`

      return {
        label,
        data,
        borderColor: rgba,
        borderWidth: width,
        borderDash: dash,
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
                if (v == null) return null
                return ` ${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
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
              callback: v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%',
            },
          },
        },
      },
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [sectorResult, relatedResults, spyResult, activeSector])

  const sectorCloses = extractCloses(sectorResult)
  const spyCloses = extractCloses(spyResult)
  const n = Math.min(sectorCloses.length, spyCloses.length)
  let badge = null
  if (n > 1) {
    const sYr = pctChange(sectorCloses[n - 1], sectorCloses[0])
    const mYr = pctChange(spyCloses[n - 1], spyCloses[0])
    const diff = (sYr ?? 0) - (mYr ?? 0)
    badge = `${activeSector.etf} ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% vs SPY · 1yr`
  }

  return (
    <Panel title={`${activeSector.short} vs. S&P 500`} badge={badge || '1 year · % return'}>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginBottom: 10 }}>
        {allEtfs.map(({ label, color, opacity, dash }) => {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          const rgba = `rgba(${r},${g},${b},${opacity})`
          return (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', opacity: opacity < 0.5 ? 0.65 : 1 }}>
              <svg width="18" height="8" style={{ flexShrink: 0 }}>
                <line x1="0" y1="4" x2="18" y2="4"
                  stroke={rgba}
                  strokeWidth={label === activeSector.etf ? 2.5 : 1.5}
                  strokeDasharray={dash?.length ? '5,4' : undefined}
                />
              </svg>
              {label}
            </span>
          )
        })}
      </div>
      <div style={{ position: 'relative', width: '100%', height: 210 }}>
        <canvas ref={canvasRef} />
      </div>
    </Panel>
  )
}
