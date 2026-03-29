import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip, Legend,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip, Legend)

export default function SectorVsMarketPanel({ sectorResult, spyResult, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!sectorResult || !spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const sectorCloses = extractCloses(sectorResult)
    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(sectorResult)
    const n = Math.min(sectorCloses.length, spyCloses.length)
    if (n < 2) return

    // Normalize both to % return from start
    const sectorBase = sectorCloses[0]
    const spyBase = spyCloses[0]
    const sectorPcts = [], spyPcts = [], labels = []

    for (let i = 0; i < n; i++) {
      if (sectorCloses[i] && spyCloses[i]) {
        sectorPcts.push(parseFloat(((sectorCloses[i] - sectorBase) / sectorBase * 100).toFixed(2)))
        spyPcts.push(parseFloat(((spyCloses[i] - spyBase) / spyBase * 100).toFixed(2)))
        const d = new Date((ts[i] || 0) * 1000)
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      }
    }

    const sectorColor = activeSector.color
    const spyColor = '#888892'

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: activeSector.etf,
            data: sectorPcts,
            borderColor: sectorColor,
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            order: 1,
          },
          {
            label: 'SPY',
            data: spyPcts,
            borderColor: spyColor,
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            order: 2,
          },
          // Shaded difference — filled area between the two lines
          {
            label: '_diff',
            data: sectorPcts.map((v, i) => v - spyPcts[i]),
            borderColor: 'transparent',
            borderWidth: 0,
            pointRadius: 0,
            fill: {
              target: { value: 0 },
              above: sectorColor + '33',
              below: '#e05050' + '33',
            },
            tension: 0.3,
            order: 3,
          },
        ],
      },
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
                if (ctx.dataset.label === '_diff') return null
                const sign = ctx.parsed.y >= 0 ? '+' : ''
                return ` ${ctx.dataset.label}: ${sign}${ctx.parsed.y.toFixed(2)}%`
              },
            },
            filter: item => item.dataset.label !== '_diff',
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
  }, [sectorResult, spyResult, activeSector])

  // Summary badge
  const sectorCloses = extractCloses(sectorResult)
  const spyCloses = extractCloses(spyResult)
  const n = Math.min(sectorCloses.length, spyCloses.length)
  let badge = null
  if (n > 1) {
    const sectorYr = pctChange(sectorCloses[n - 1], sectorCloses[0])
    const spyYr = pctChange(spyCloses[n - 1], spyCloses[0])
    const diff = sectorYr - spyYr
    const sign = diff >= 0 ? '+' : ''
    badge = `${activeSector.etf} ${sign}${diff?.toFixed(1)}% vs SPY`
  }

  return (
    <Panel title={`${activeSector.short} vs. S&P 500`} badge={badge || '1 year · % return'}>
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 10,
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 16, height: 2, background: activeSector.color, display: 'inline-block', borderRadius: 1 }} />
          {activeSector.etf} (sector ETF)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 16, height: 2, background: '#888892', display: 'inline-block', borderRadius: 1, opacity: 0.6 }} />
          SPY (S&P 500)
        </span>
        <span style={{ fontSize: 10 }}>Shaded = outperformance gap</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <canvas ref={canvasRef} />
      </div>
    </Panel>
  )
}
