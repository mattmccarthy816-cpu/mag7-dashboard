import React from 'react'
import { SECTORS } from '../constants'

export default function SectorTabs({ activeSector, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      overflowX: 'auto',
      paddingBottom: 2,
      marginBottom: 16,
      scrollbarWidth: 'none',
    }}>
      {SECTORS.map(s => {
        const active = activeSector.id === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s)}
            style={{
              flexShrink: 0,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              padding: '6px 14px',
              borderRadius: 20,
              border: active ? `1.5px solid ${s.color}` : '0.5px solid var(--border)',
              background: active ? s.color + '22' : 'var(--bg-card)',
              color: active ? s.color : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {s.short}
          </button>
        )
      })}
    </div>
  )
}
