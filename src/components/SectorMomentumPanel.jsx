import React, { useMemo } from 'react'
import Panel from './Panel'
import { extractCloses, pctChange } from '../api'

function calcMomentum(results, syms) {
  const signals = results.map((r, i) => {
    if (!r) return null
    const closes = extractCloses(r)
    if (closes.length < 20) return null
    const price = closes[closes.length - 1]
    const high52 = Math.max(...closes)
    const low52 = Math.min(...closes)
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null
    const ret1m = closes.length >= 21 ? pctChange(price, closes[closes.length - 21]) : null
    const ret3m = closes.length >= 63 ? pctChange(price, closes[closes.length - 63]) : null
    const retYr = pctChange(price, closes[0])
    // Position in 52w range 0–100
    const range52 = high52 === low52 ? 50 : ((price - low52) / (high52 - low52)) * 100
    // Trend: above ma20 and ma50 = bullish
    const aboveMa20 = price > ma20
    const aboveMa50 = ma50 ? price > ma50 : null
    // Score: weighted combo
    let score = 50
    score += (range52 - 50) * 0.3
    if (aboveMa20) score += 10; else score -= 10
    if (aboveMa50 !== null) { if (aboveMa50) score += 8; else score -= 8 }
    if (ret1m != null) score += Math.max(-15, Math.min(15, ret1m * 1.2))
    if (ret3m != null) score += Math.max(-10, Math.min(10, ret3m * 0.4))
    score = Math.max(0, Math.min(100, score))
    return { sym: syms[i], score: Math.round(score), ret1m, ret3m, retYr, range52: Math.round(range52) }
  }).filter(Boolean)

  if (!signals.length) return null
  const avg = signals.reduce((s, x) => s + x.score, 0) / signals.length
  return { overall: Math.round(avg), signals }
}

function scoreLabel(s) {
  if (s >= 75) return { label: 'Strong Bullish', color: '#1fb87a' }
  if (s >= 60) return { label: 'Bullish', color: '#7ab87a' }
  if (s >= 45) return { label: 'Neutral', color: '#e8a835' }
  if (s >= 30) return { label: 'Bearish', color: '#e07840' }
  return { label: 'Strong Bearish', color: '#e05050' }
}

export default function SectorMomentumPanel({ top7Results, activeSector }) {
  const momentum = useMemo(
    () => calcMomentum(top7Results, activeSector.top7),
    [top7Results, activeSector]
  )

  if (!momentum) {
    return (
      <Panel title="Sector Momentum">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          Loading momentum data…
        </div>
      </Panel>
    )
  }

  const { label, color } = scoreLabel(momentum.overall)

  return (
    <Panel title={`${activeSector.short} Momentum`}>
      {/* Overall score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 42, fontWeight: 600, color, lineHeight: 1 }}>
          {momentum.overall}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color }}>{label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>out of 100</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{
        width: '100%', height: 6, borderRadius: 3,
        background: 'linear-gradient(to right, #e05050, #e8a835, #1fb87a)',
        position: 'relative', marginBottom: 14,
      }}>
        <div style={{
          position: 'absolute', top: -5,
          left: `${momentum.overall}%`,
          width: 3, height: 16,
          background: 'var(--text-primary)',
          borderRadius: 2,
          transform: 'translateX(-50%)',
        }} />
      </div>

      {/* Per-stock signals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {momentum.signals.map(s => {
          const { color: sc } = scoreLabel(s.score)
          const sign = (v) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : '—'
          return (
            <div key={s.sym} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 40, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{s.sym}</div>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 3, height: 5 }}>
                <div style={{ width: `${s.score}%`, height: 5, borderRadius: 3, background: sc }} />
              </div>
              <div style={{ width: 26, fontSize: 10, textAlign: 'right', color: sc, fontWeight: 600 }}>{s.score}</div>
              <div style={{ width: 48, fontSize: 10, textAlign: 'right', color: s.ret1m >= 0 ? '#1fb87a' : '#e05050' }}>
                {sign(s.ret1m)}
              </div>
              <div style={{ width: 48, fontSize: 10, textAlign: 'right', color: 'var(--text-muted)' }}>
                {sign(s.retYr)} yr
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
        Score based on 52w range, MA20/50 trend, 1m &amp; 3m returns
      </div>
    </Panel>
  )
}
