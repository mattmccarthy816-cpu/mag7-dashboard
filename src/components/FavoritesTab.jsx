import React from 'react'
import TickerCard from './TickerCard'
import Panel from './Panel'

export default function FavoritesTab({ favorites, favData, spResult, onToggleFav }) {
  if (favorites.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 20px', gap: 12,
        color: 'var(--text-muted)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>♡</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>No favorites yet</div>
        <div style={{ fontSize: 12 }}>Click the heart on any stock card to add it here</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
        gap: 8, marginBottom: 12,
      }} className="ticker-row">
        {favorites.map(sym => (
          <TickerCard
            key={sym}
            result={favData[sym] ?? null}
            sym={sym}
            isFav
            onToggleFav={onToggleFav}
          />
        ))}
        <TickerCard result={spResult} sym="S&P 500" name="^GSPC" isSP500 />
      </div>

      <div style={{
        marginTop: 8,
        fontSize: 12,
        color: 'var(--text-muted)',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        Showing {favorites.length} favorited stock{favorites.length !== 1 ? 's' : ''} vs S&P 500.
        Click ♥ on any card to remove it from favorites.
      </div>
    </div>
  )
}
