import React from 'react'
import Panel from './Panel'
import { SP_SECTORS } from '../constants'

export default function SectorPanel({ activeSector }) {
  const sorted = [...SP_SECTORS].sort((a, b) => b.pct - a.pct)
  const max = sorted[0].pct

  return (
    <Panel title="S&P 500 Sectors" badge="by weight">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sorted.map((s) => {
          const isActive = s.name === activeSector.short
          return (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 96,
                fontSize: 11,
                color: isActive ? s.color : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 0,
              }}>
                {isActive ? '▶ ' : ''}{s.name}
              </div>
              <div style={{
                flex: 1,
                background: 'var(--bg-secondary)',
                borderRadius: 3,
                height: 6,
              }}>
                <div style={{
                  width: `${(s.pct / max) * 100}%`,
                  height: 6,
                  borderRadius: 3,
                  background: s.color,
                  opacity: isActive ? 1 : 0.35,
                }} />
              </div>
              <div style={{
                width: 36,
                textAlign: 'right',
                fontSize: 11,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? s.color : 'var(--text-secondary)',
                flexShrink: 0,
              }}>
                {s.pct}%
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
        Source: SPDR S&P 500 · Updated quarterly
      </div>
    </Panel>
  )
}
