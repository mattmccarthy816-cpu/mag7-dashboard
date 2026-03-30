import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchYahooMany, fetchFearGreed } from './api'
import { SECTORS } from './constants'
import SectorTabs from './components/SectorTabs'
import TickerCard from './components/TickerCard'
import FearGreedPanel from './components/FearGreedPanel'
import SectorMomentumPanel from './components/SectorMomentumPanel'
import SectorPanel from './components/SectorPanel'
import SectorVsMarketPanel from './components/SectorVsMarketPanel'
import Top7McapPanel from './components/Top7McapPanel'
import SectorAnalysisPanel from './components/SectorAnalysisPanel'

const REFRESH_MS = 60_000

export default function App() {
  const [activeSector, setActiveSector] = useState(SECTORS[0])
  const [spResult, setSpResult] = useState(null)
  const [spyResult, setSpyResult] = useState(null)
  const [fearGreed, setFearGreed] = useState(null)
  const [top7Results, setTop7Results] = useState(Array(7).fill(null))
  const [sectorEtfResult, setSectorEtfResult] = useState(null)
  const [relatedResults, setRelatedResults] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sectorLoading, setSectorLoading] = useState(false)
  const sectorCache = useRef({})

  const fetchBase = useCallback(async () => {
    const [results, fg] = await Promise.all([
      fetchYahooMany(['^GSPC', 'SPY'], '1y', '1d'),
      fetchFearGreed(),
    ])
    setSpResult(results[0])
    setSpyResult(results[1])
    setFearGreed(fg)
  }, [])

  const fetchSector = useCallback(async (sector, force = false) => {
    const key = sector.id
    if (!force && sectorCache.current[key]) {
      const c = sectorCache.current[key]
      setTop7Results(c.top7)
      setSectorEtfResult(c.etf)
      setRelatedResults(c.related)
      return
    }
    setSectorLoading(true)
    const syms = [...sector.top7, sector.etf, ...sector.relatedEtfs]
    const results = await fetchYahooMany(syms, '1y', '1d')
    const top7 = results.slice(0, 7)
    const etf = results[7]
    const related = results.slice(8, 8 + sector.relatedEtfs.length)
    sectorCache.current[key] = { top7, etf, related }
    setTop7Results(top7)
    setSectorEtfResult(etf)
    setRelatedResults(related)
    setSectorLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchBase(), fetchSector(SECTORS[0])])
      setLastUpdated(new Date())
      setLoading(false)
    }
    init()
    const id = setInterval(() => {
      sectorCache.current = {}
      fetchBase()
      fetchSector(activeSector, true)
      setLastUpdated(new Date())
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const handleSectorChange = useCallback((sector) => {
    setActiveSector(sector)
    fetchSector(sector)
  }, [fetchSector])

  const handleRefresh = async () => {
    setLoading(true)
    sectorCache.current = {}
    await Promise.all([fetchBase(), fetchSector(activeSector, true)])
    setLastUpdated(new Date())
    setLoading(false)
  }

  const fade = { opacity: sectorLoading ? 0.45 : 1, transition: 'opacity 0.2s' }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            S&P 500 Sector Dashboard
          </h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-time · Top 7 holdings · Sector vs market
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={handleRefresh} disabled={loading} style={{
            fontSize: 11, padding: '5px 12px',
            background: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: loading ? 'default' : 'pointer',
          }}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Sector tabs */}
      <SectorTabs activeSector={activeSector} onChange={handleSectorChange} />

      {/* Row 1: Top 7 ticker cards + S&P 500 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
        gap: 8, marginBottom: 12, ...fade,
      }} className="ticker-row">
        {activeSector.top7.map((sym, i) => (
          <TickerCard key={sym} result={top7Results[i]} sym={sym} />
        ))}
        <TickerCard result={spResult} sym="S&P 500" name="^GSPC" isSP500 />
      </div>

      {/* Row 2: Sector Momentum | AI Analysis | Sector Breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12, marginBottom: 12, ...fade,
      }} className="mid-row">
        <SectorMomentumPanel top7Results={top7Results} activeSector={activeSector} />
        <SectorAnalysisPanel
          activeSector={activeSector}
          top7Results={top7Results}
          sectorResult={sectorEtfResult}
          spyResult={spyResult}
        />
        <SectorPanel activeSector={activeSector} />
      </div>

      {/* Row 3: Sector vs Market | Top 7 share of S&P 500 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: 12, ...fade,
      }} className="bot-row">
        <SectorVsMarketPanel
          sectorResult={sectorEtfResult}
          relatedResults={relatedResults}
          spyResult={spyResult}
          activeSector={activeSector}
        />
        <Top7McapPanel
          top7Results={top7Results}
          spyResult={spyResult}
          activeSector={activeSector}
        />
      </div>

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
