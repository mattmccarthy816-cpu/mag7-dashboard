import React from 'react'
import { SECTORS } from '../constants'

export default function SectorTabs({ activeSector, onChange, favCount }) {
  const isFavTab = activeSector?.id === 'favorites'

  return (
    <div style={{
      display: 'flex', gap: 4, overflowX: 'auto',
      paddingBottom: 2, marginBottom: 16, scrollbarWidth: 'none',
    }}>
      {/* Favorites tab */}
      <button
        onClick={() => onChange({ id: 'favorites', short: 'Favorites', color: '#e05050' })}
        style={{
          flexShrink: 0, fontSize: 12,
          fontWeight: isFavTab ? 600 : 400,
          padding: '6px 14px', borderRadius: 20,
          border: isFavTab ? '1.5px solid #e05050' : '0.5px solid var(--border)',
          background: isFavTab ? '#e0505022' : 'var(--bg-card)',
          color: isFavTab ? '#e05050' : 'var(--text-secondary)',
          cursor: 'pointer', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        ♥ Favorites {favCount > 0 && (
          <span style={{
            fontSize: 10, background: '#e05050', color: '#fff',
            borderRadius: 10, padding: '1px 5px', fontWeight: 700,
          }}>{favCount}</span>
        )}
      </button>

      {/* Screener tab */}
      <button
        onClick={() => onChange({ id: 'screener', short: 'Screener', color: '#4ab8b8' })}
        style={{
          flexShrink: 0, fontSize: 12,
          fontWeight: activeSector?.id === 'screener' ? 600 : 400,
          padding: '6px 14px', borderRadius: 20,
          border: activeSector?.id === 'screener' ? '1.5px solid #4ab8b8' : '0.5px solid var(--border)',
          background: activeSector?.id === 'screener' ? '#4ab8b822' : 'var(--bg-card)',
          color: activeSector?.id === 'screener' ? '#4ab8b8' : 'var(--text-secondary)',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        ⊞ Screener
      </button>

      {/* Divider */}
      <div style={{ width: 1, background: 'var(--border)', margin: '4px 4px', flexShrink: 0 }} />

      {/* Sector tabs */}
      {SECTORS.map(s => {
        const active = !isFavTab && activeSector?.id === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s)}
            style={{
              flexShrink: 0, fontSize: 12,
              fontWeight: active ? 600 : 400,
              padding: '6px 14px', borderRadius: 20,
              border: active ? `1.5px solid ${s.color}` : '0.5px solid var(--border)',
              background: active ? s.color + '22' : 'var(--bg-card)',
              color: active ? s.color : 'var(--text-secondary)',
              cursor: 'pointer', whiteSpace: 'nowrap',
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
