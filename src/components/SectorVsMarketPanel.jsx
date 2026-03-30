import React, { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import Panel from './Panel'
import { extractCloses, extractTimestamps, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip)

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

export default function SectorVsMarketPanel({ sectorResult, relatedResults, spyResult, activeSector, onExpand }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const hoveredRef = useRef(null)

  const etfConfigs = [
    { label: activeSector.etf, result: sectorResult,       color: activeSector.color, dash: [] },
    ...activeSector.relatedEtfs.map((etf, i) => ({
      label: etf, result: relatedResults?.[i] ?? null, color: activeSector.color, dash: [],
    })),
    { label: 'SPY', result: spyResult, color: '#c8c8d8', dash: [6,3] },
  ]

  useEffect(() => {
    if (!spyResult || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const spyCloses = extractCloses(spyResult)
    const ts = extractTimestamps(spyResult)
    if (spyCloses.length < 2) return

    const n = spyCloses.length
    const labels = ts.map(t => new Date(t*1000).toLocaleDateString('en-US', { month:'short', day:'numeric' }))

    const datasets = etfConfigs.map(({ label, result, color, dash }) => {
      const closes = result ? extractCloses(result) : []
      const base = closes[0]
      const data = Array(n).fill(null)
      for (let i = 0; i < Math.min(closes.length, n); i++) {
        if (closes[i] && base) data[i] = parseFloat(((closes[i]-base)/base*100).toFixed(2))
      }
      const isSPY = label === 'SPY'
      return {
        label, data,
        borderColor: hexToRgba(color, isSPY ? 0.75 : 0.5),
        borderWidth: isSPY ? 2 : 1,
        borderDash: dash,
        pointRadius: 0, fill: false, tension: 0.3, spanGaps: true,
        // Store original color for hover restore
        _color: color,
        _isSPY: isSPY,
      }
    })

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: { grid:{ display:false }, ticks:{ color:'#555', font:{size:10}, maxTicksLimit:8, maxRotation:0 } },
          y: { grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#555', font:{size:10}, callback: v => (v>=0?'+':'')+v.toFixed(0)+'%' } },
        },
        onHover: (event, elements) => {
          if (!chartRef.current) return
          const chart = chartRef.current
          const hoveredDatasetIndex = elements.length > 0 ? elements[0].datasetIndex : null

          // Check if hover state changed
          if (hoveredRef.current === hoveredDatasetIndex) return
          hoveredRef.current = hoveredDatasetIndex

          chart.data.datasets.forEach((ds, i) => {
            const isSPY = ds._isSPY
            if (hoveredDatasetIndex === null) {
              // Nothing hovered — restore defaults
              ds.borderColor = hexToRgba(ds._color, isSPY ? 0.75 : 0.5)
              ds.borderWidth = isSPY ? 2 : 1
            } else if (i === hoveredDatasetIndex) {
              // This line is hovered — bold + full opacity
              ds.borderColor = hexToRgba(ds._color, 1)
              ds.borderWidth = 2.5
            } else {
              // Other lines — fade further
              ds.borderColor = hexToRgba(ds._color, 0.15)
              ds.borderWidth = isSPY ? 1.5 : 0.8
            }
          })
          chart.update('none')
        },
      },
    })

    // Also handle mouseout on the canvas
    const canvas = canvasRef.current
    const handleMouseLeave = () => {
      if (!chartRef.current) return
      hoveredRef.current = null
      chartRef.current.data.datasets.forEach(ds => {
        ds.borderColor = hexToRgba(ds._color, ds._isSPY ? 0.75 : 0.5)
        ds.borderWidth = ds._isSPY ? 2 : 1
      })
      chartRef.current.update('none')
    }
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      if (chartRef.current) chartRef.current.destroy()
    }
  }, [sectorResult, relatedResults, spyResult, activeSector])

  const sc = extractCloses(sectorResult), sp = extractCloses(spyResult)
  const n = Math.min(sc.length, sp.length)
  const badge = n > 1 ? (() => {
    const diff = (pctChange(sc[n-1],sc[0])??0) - (pctChange(sp[n-1],sp[0])??0)
    return `${activeSector.etf} ${diff>=0?'+':''}${diff.toFixed(1)}% vs SPY · 1yr`
  })() : null

  return (
    <Panel title={`${activeSector.short} vs. S&P 500`} badge={badge||'1 year · % return'}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 14px' }}>
          {etfConfigs.map(({ label, color, dash }) => {
            const isSPY = label === 'SPY'
            return (
              <span key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)' }}>
                <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5"
                  stroke={hexToRgba(color, isSPY ? 0.75 : 0.5)}
                  strokeWidth={isSPY ? 2 : 1}
                  strokeDasharray={dash?.length ? '6,3' : undefined}
                /></svg>
                {label}
              </span>
            )
          })}
        </div>
        {onExpand && (
          <button onClick={onExpand} style={{ fontSize:11, padding:'3px 10px', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:6, color:'var(--text-secondary)', cursor:'pointer', flexShrink:0 }}>
            ⤢ Expand
          </button>
        )}
      </div>
      <div style={{ position:'relative', width:'100%', height:210 }}>
        <canvas ref={canvasRef} />
      </div>
    </Panel>
  )
}
