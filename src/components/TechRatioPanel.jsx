import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

export default function TechRatioPanel({ xlkResult, spyResult }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!xlkResult || !spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const xlkClose = extractCloses(xlkResult)
    const spyClose = extractCloses(spyResult)
    const ts = extractTimestamps(xlkResult)
    const n = Math.min(xlkClose.length, spyClose.length)

    const ratios = [], labels = []
    for (let i = 0; i < n; i++) {
      if (xlkClose[i] && spyClose[i]) {
        ratios.push(parseFloat((xlkClose[i] / spyClose[i]).toFixed(4)))
        const d = new Date(ts[i] * 1000)
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      }
    }

    if (ratios.length < 2) return

    const first = ratios[0], last = ratios[ratios.length - 1]
    const isUp = last >= first
    const lineColor = isUp ? '#1fb87a' : '#e05050'
    const fillColor = isUp ? 'rgba(31,184,122,0.1)' : 'rgba(224,80,80,0.1)'

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: ratios,
          borderColor: lineColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: fillColor,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ' Ratio: ' + ctx.parsed.y.toFixed(4) },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#555', font: { size: 10 }, callback: v => v.toFixed(3) },
          },
        },
      },
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [xlkResult, spyResult])

  const xlkClose = extractCloses(xlkResult)
  const spyClose = extractCloses(spyResult)
  const n = Math.min(xlkClose.length, spyClose.length)
  let badge = null
  if (n > 1) {
    const first = xlkClose[0] / spyClose[0]
    const last = xlkClose[n - 1] / spyClose[n - 1]
    const chg = pctChange(last, first)
    const sign = chg >= 0 ? '+' : ''
    badge = `${sign}${chg?.toFixed(1)}% vs market`
  }

  return (
    <Panel title="Tech vs. Market" badge={badge || 'XLK / SPY · 1 year'}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        Ratio of XLK (Tech ETF) to SPY (S&P 500 ETF) — rising = tech outperforming
      </div>
      <div style={{ position: 'relative', width: '100%', height: 170 }}>
        <canvas ref={canvasRef} />
      </div>
    </Panel>
  )
}
