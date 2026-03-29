import React from 'react'

export default function Panel({ title, badge, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {title}
          {badge && (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              padding: '2px 7px',
              borderRadius: 10,
              textTransform: 'none',
              letterSpacing: 0,
            }}>
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
