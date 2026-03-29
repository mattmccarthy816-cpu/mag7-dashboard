import React, { useState, useEffect, useCallback } from 'react'
import { fetchYahoo, fetchFearGreed } from './api'
import { MAG7 } from './constants'
import TickerCard from './components/TickerCard'
import FearGreedPanel from './components/FearGreedPanel'
import SP500Panel from './components/SP500Panel'
import SectorPanel from './components/SectorPanel'
import TechRatioPanel from './components/TechRatioPanel'
import McapPanel from './components/McapPanel'
import PlaceholderPanel from './components/PlaceholderPanel'

const REFRESH_MS = 60_000 // auto-refresh every 60s

export default function App() {
  const [mag7Results, setMag7Results] = useState(Array(7).fill(null))
  const [spResult, setSpResult] = useState(null)
  const [xlkResult, setXlkResult] = useState(null)
  const [spyResult, setSpyResult] = useState(null)
  const [fearGreed, setFearGreed] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [mag7, sp, xlk, spy, fg] = await Promise.all([
      Promise.all(MAG7.map(m => fetchYahoo(m.sym, '1y', '1d'))),
      fetchYahoo('^GSPC', '1y', '1d'),
      fetchYahoo('XLK', '1y', '1d'),
      fetchYahoo('SPY', '1y', '1d'),
      fetchFearGreed(),
    ])
    setMag7Results(mag7)
    setSpResult(sp)
    setXlkResult(xlk)
    setSpyResult(spy)
    setFearGreed(fg)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Market Dashboard
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Mag 7 · S&P 500 · Tech vs Market
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              fontSize: 11,
              padding: '5px 12px',
              background: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Ticker row — Mag7 + S&P 500 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
        gap: 8,
        marginBottom: 12,
      }}
        className="ticker-row"
      >
        {MAG7.map((m, i) => (
          <TickerCard
            key={m.sym}
            result={mag7Results[i]}
            sym={m.sym}
            name={m.name}
            color={null}
          />
        ))}
        <TickerCard
          result={spResult}
          sym="S&P 500"
          name="^GSPC"
          isSP500
        />
      </div>

      {/* Mid row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        marginBottom: 12,
      }}
        className="mid-row"
      >
        <FearGreedPanel data={fearGreed} />
        <SP500Panel result={spResult} />
        <SectorPanel />
      </div>

      {/* Bottom row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 12,
      }}
        className="bot-row"
      >
        <TechRatioPanel xlkResult={xlkResult} spyResult={spyResult} />
        <McapPanel mag7Results={mag7Results} />
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .ticker-row { grid-template-columns: repeat(4, minmax(0,1fr)) !important; }
        }
        @media (max-width: 680px) {
          .ticker-row { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .mid-row { grid-template-columns: 1fr !important; }
          .bot-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
