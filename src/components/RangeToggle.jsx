import React from 'react'

const RANGES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '1W', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
]

export { RANGES }

export default function RangeToggle({ active, onChange, color = '#4a8fd4' }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {RANGES.map(r => {
        const isActive = r.label === active
        return (
          <button
            key={r.label}
            onClick={() => onChange(r)}
            style={{
              fontSize: 10, fontWeight: isActive ? 600 : 400,
              padding: '3px 7px',
              background: isActive ? color + '33' : 'transparent',
              border: isActive ? `1px solid ${color}66` : '1px solid transparent',
              borderRadius: 5,
              color: isActive ? color : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
