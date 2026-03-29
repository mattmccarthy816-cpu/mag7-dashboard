import React from 'react'
import Panel from './Panel'

function gaugeColor(val) {
  if (val <= 30) return '#e05050'
  if (val <= 50) return '#e8a835'
  if (val <= 70) return '#1fb87a'
  return '#1fb87a'
}

export default function FearGreedPanel({ data }) {
  const val = data?.val ?? null
  const label = data?.rating ?? '—'

  return (
    <Panel title="Fear & Greed Index">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
        <div style={{
          fontSize: 48,
          fontWeight: 500,
          lineHeight: 1,
          color: val != null ? gaugeColor(val) : 'var(--text-muted)',
        }}>
          {val ?? '—'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{label}</div>

        <div style={{
          width: '100%',
          height: 8,
          borderRadius: 4,
          background: 'linear-gradient(to right, #e05050, #e8a835, #1fb87a)',
          marginTop: 16,
          position: 'relative',
        }}>
          {val != null && (
            <div style={{
              position: 'absolute',
              top: -5,
              left: `${val}%`,
              width: 3,
              height: 18,
              background: 'var(--text-primary)',
              borderRadius: 2,
              transform: 'translateX(-50%)',
            }} />
          )}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 5,
        }}>
          <span>Extreme Fear</span>
          <span>Neutral</span>
          <span>Extreme Greed</span>
        </div>
      </div>
    </Panel>
  )
}
