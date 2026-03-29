import React from 'react'
import Panel from './Panel'

export default function PlaceholderPanel({ title = 'Future Index', description = 'Wire up your custom index here' }) {
  return (
    <Panel title={title} badge="placeholder">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)',
        gap: 6,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 22, opacity: 0.3 }}>+</div>
        <div style={{ fontSize: 12 }}>{description}</div>
        <div style={{ fontSize: 10, opacity: 0.6 }}>Add your data source in constants.js</div>
      </div>
    </Panel>
  )
}
