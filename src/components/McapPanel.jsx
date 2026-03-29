import React, { useEffect, useRef } from 'react'
import {
  Chart, BarElement, BarController,
  CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import Panel from './Panel'
import { fmtMcap } from '../api'
import { MAG7, TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip)

export default function McapPanel({ mag7Results }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const valid = mag7Results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r && r.meta?.marketCap)

  useEffect(() => {
    if (!canvasRef.current || valid.length === 0) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = valid.map(({ i }) => MAG7[i].sym)
    const values = valid.map(({ r }) => parseFloat((r.meta.marketCap / 1e12).toFixed(3)))
    const colors = valid.map(({ i }) => TICKER_COLORS[i])

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ' $' + ctx.parsed.y.toFixed(2) + 'T' },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#555', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#555', font: { size: 10 }, callback: v => '$' + v + 'T' },
          },
        },
      },
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [mag7Results])

  const totalMcap = valid.reduce((s, { r }) => s + r.meta.marketCap, 0)

  return (
    <Panel title="Mag 7 Market Cap">
      <div style={{ position: 'relative', width: '100%', height: 170 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        marginTop: 10,
      }}>
        {valid.map(({ r, i }) => (
          <span key={MAG7[i].sym} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: 'var(--text-secondary)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 2,
              background: TICKER_COLORS[i], display: 'inline-block',
            }} />
            {MAG7[i].sym} {fmtMcap(r.meta.marketCap)}
          </span>
        ))}
      </div>
      {totalMcap > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Combined: {fmtMcap(totalMcap)}
        </div>
      )}
    </Panel>
  )
}
