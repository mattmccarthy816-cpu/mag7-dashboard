import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchYahooMany, fetchFearGreed } from './api'
import { SECTORS } from './constants'
import SectorTabs from './components/SectorTabs'
import TickerCard from './components/TickerCard'
import SectorMomentumPanel from './components/SectorMomentumPanel'
import SectorPanel from './components/SectorPanel'
import SectorVsMarketPanel from './components/SectorVsMarketPanel'
import Top7McapPanel from './components/Top7McapPanel'
import SectorAnalysisPanel from './components/SectorAnalysisPanel'
import FavoritesTab from './components/FavoritesTab'

const REFRESH_MS = 60_000
const FAV_KEY = 'dashboard_favorites'

function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}
function saveFavs(favs) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)) } catch {}
}

export default function App() {
  const [activeSector, setActiveSector] = useState(SECTORS[0])
  const [spResult, setSpResult] = useState(null)
  const [spyResult, setSpyResult] = useState(null)
  const [top7Results, setTop7Results] = useState(Array(7).fill(null))
  const [sectorEtfResult, setSectorEtfResult] = useState(null)
  const [relatedResults, setRelatedResults] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sectorLoading, setSectorLoading] = useState(false)
  const sectorCache = useRef({})

  // Favorites state
  const [favorites, setFavorites] = useState(loadFavs)
  const [favData, setFavData] = useState({})

  const fetchBase = useCallback(async () => {
    const results = await fetchYahooMany(['^GSPC', 'SPY'], '1y', '1d')
    setSpResult(results[0])
    setSpyResult(results[1])
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

  // Fetch favorites data whenever favorites list changes
  useEffect(() => {
    if (!favorites.length) return
    fetchYahooMany(favorites, '1y', '1d').then(results => {
      const map = {}
      favorites.forEach((sym, i) => { map[sym] = results[i] })
      setFavData(map)
    })
  }, [favorites])

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
      if (activeSector.id !== 'favorites') fetchSector(activeSector, true)
      setLastUpdated(new Date())
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const handleSectorChange = useCallback((sector) => {
    setActiveSector(sector)
    if (sector.id !== 'favorites') fetchSector(sector)
  }, [fetchSector])

  const handleToggleFav = useCallback((sym) => {
    setFavorites(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
      saveFavs(next)
      return next
    })
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    sectorCache.current = {}
    await Promise.all([fetchBase(), activeSector.id !== 'favorites' && fetchSector(activeSector, true)])
    setLastUpdated(new Date())
    setLoading(false)
  }

  const isFavTab = activeSector.id === 'favorites'
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
      <SectorTabs
        activeSector={activeSector}
        onChange={handleSectorChange}
        favCount={favorites.length}
      />

      {/* Favorites view */}
      {isFavTab ? (
        <FavoritesTab
          favorites={favorites}
          favData={favData}
          spResult={spResult}
          onToggleFav={handleToggleFav}
        />
      ) : (
        <>
          {/* Row 1: Top 7 ticker cards + S&P 500 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
            gap: 8, marginBottom: 12, ...fade,
          }} className="ticker-row">
            {activeSector.top7.map((sym, i) => (
              <TickerCard
                key={sym}
                result={top7Results[i]}
                sym={sym}
                isFav={favorites.includes(sym)}
                onToggleFav={handleToggleFav}
              />
            ))}
            <TickerCard result={spResult} sym="S&P 500" name="^GSPC" isSP500 />
          </div>

          {/* Row 2: Momentum | AI Analysis | Sector Breakdown */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
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

          {/* Row 3: Sector vs Market | Top 7 share */}
          <div style={{
            display: 'grid', gridTemplateColumns: '3fr 2fr',
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
        </>
      )}

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
