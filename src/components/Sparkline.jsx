import React, { useEffect, useRef } from 'react'
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler } from 'chart.js'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler)

export default function Sparkline({ prices = [], color = '#1fb87a', height = 36 }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || prices.length < 2) return
    if (chartRef.current) chartRef.current.destroy()

    const fill = color + '22'

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: prices.map((_, i) => i),
        datasets: [{
          data: prices,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          backgroundColor: fill,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: {
            display: false,
            min: Math.min(...prices) * 0.995,
            max: Math.max(...prices) * 1.005,
          },
        },
      },
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [prices, color])

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
