import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchYahooMany } from './api'
import { SECTORS } from './constants'
import SectorTabs from './components/SectorTabs'
import TickerCard from './components/TickerCard'
import SectorMomentumPanel from './components/SectorMomentumPanel'
import SectorPanel from './components/SectorPanel'
import SectorVsMarketPanel from './components/SectorVsMarketPanel'
import SectorAnalysisPanel from './components/SectorAnalysisPanel'
import FavoritesTab from './components/FavoritesTab'
import ChartModal from './components/ChartModal'
import TickerSearch from './components/TickerSearch'
import SectorHeatmap from './components/SectorHeatmap'
import NewsFeed from './components/NewsFeed'
import AllStocksHeatmap from './components/AllStocksHeatmap'
import StockScreener from './components/StockScreener'

const REFRESH_MS = 60_000
const FAV_KEY    = 'dashboard_favorites'
const loadFavs   = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] } }
const saveFavs   = f  => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)) } catch {} }

const RANGE_CONFIGS = [
  { label: '1D', range: '1d',  interval: '5m'  },
  { label: '1W', range: '5d',  interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d'  },
  { label: '3M', range: '3mo', interval: '1d'  },
  { label: '1Y', range: '1y',  interval: '1d'  },
]

export default function App() {
  const [activeSector, setActiveSector]   = useState(SECTORS[0])
  const [sectorByRange, setSectorByRange] = useState({})
  const [baseByRange, setBaseByRange]     = useState({})
  const [heatmapEtfs, setHeatmapEtfs]    = useState({})
  const [allTop7Data, setAllTop7Data]     = useState({})
  const [lastUpdated, setLastUpdated]     = useState(null)
  const [loading, setLoading]             = useState(true)
  const [favorites, setFavorites]         = useState(loadFavs)
  const [modal, setModal]                 = useState(null)
  const sectorCache  = useRef({})
  const prevSectorId = useRef(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAllBase = useCallback(async () => {
    const all = await Promise.all(
      RANGE_CONFIGS.map(rc => fetchYahooMany(['^GSPC', 'SPY'], rc.range, rc.interval))
    )
    const byRange = {}
    RANGE_CONFIGS.forEach((rc, i) => {
      byRange[rc.label] = { sp: all[i][0], spy: all[i][1] }
    })
    setBaseByRange(byRange)
    return byRange
  }, [])

  const fetchHeatmapData = useCallback(async () => {
    const etfSyms = SECTORS.map(s => s.etf)
    const etfResults = await fetchYahooMany(etfSyms, '1y', '1d')
    const etfMap = {}
    SECTORS.forEach((s, i) => { etfMap[s.id] = etfResults[i] })
    setHeatmapEtfs(etfMap)

    const allSyms = SECTORS.flatMap(s => s.top7)
    const allResults = await fetchYahooMany(allSyms, '1y', '1d')
    const top7Map = {}
    let idx = 0
    SECTORS.forEach(s => {
      top7Map[s.id] = allResults.slice(idx, idx + s.top7.length)
      idx += s.top7.length
    })
    setAllTop7Data(top7Map)
  }, [])

  const fetchAllSector = useCallback(async (sector, base, force = false) => {
    setSectorByRange({})
    await Promise.all(RANGE_CONFIGS.map(async rc => {
      const key = `${sector.id}|${rc.label}`
      let data
      if (!force && sectorCache.current[key]) {
        data = sectorCache.current[key]
      } else {
        const syms = [...sector.top7, sector.etf, ...sector.relatedEtfs]
        const results = await fetchYahooMany(syms, rc.range, rc.interval)
        data = {
          top7:    results.slice(0, 7),
          etf:     results[7] ?? null,
          related: results.slice(8, 8 + sector.relatedEtfs.length),
          spy:     base?.[rc.label]?.spy ?? null,
        }
        sectorCache.current[key] = data
      }
      setSectorByRange(prev => ({ ...prev, [rc.label]: data }))
    }))
  }, [])

  // ── Init & refresh ─────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const base = await fetchAllBase()
      prevSectorId.current = SECTORS[0].id
      await Promise.all([fetchAllSector(SECTORS[0], base), fetchHeatmapData()])
      setLastUpdated(new Date())
      setLoading(false)
    }
    init()

    const id = setInterval(async () => {
      sectorCache.current = {}
      const base = await fetchAllBase()
      const cur = prevSectorId.current
      if (cur && cur !== 'favorites' && cur !== 'screener') {
        const sector = SECTORS.find(s => s.id === cur) ?? SECTORS[0]
        fetchAllSector(sector, base, true)
      }
      fetchHeatmapData()
      setLastUpdated(new Date())
    }, REFRESH_MS)

    return () => clearInterval(id)
  }, []) // eslint-disable-line

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSectorChange = useCallback((sector) => {
    setActiveSector(sector)
    if (sector.id === 'favorites' || sector.id === 'screener') return
    if (sector.id === prevSectorId.current) return
    prevSectorId.current = sector.id
    fetchAllBase().then(base => fetchAllSector(sector, base))
  }, [fetchAllBase, fetchAllSector])

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
    const base = await fetchAllBase()
    const cur = activeSector
    await Promise.all([
      (cur.id !== 'favorites' && cur.id !== 'screener') ? fetchAllSector(cur, base, true) : Promise.resolve(),
      fetchHeatmapData(),
    ])
    setLastUpdated(new Date())
    setLoading(false)
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const spResult1Y  = baseByRange['1Y']?.sp  ?? null
  const spyResult1Y = baseByRange['1Y']?.spy ?? null

  const spRangeMap = useMemo(() => {
    const out = {}
    RANGE_CONFIGS.forEach(rc => { out[rc.label] = baseByRange[rc.label]?.sp ?? null })
    return out
  }, [baseByRange])

  const cardRangeMaps = useMemo(() => {
    return activeSector.top7
      ? activeSector.top7.map((_, i) => {
          const out = {}
          RANGE_CONFIGS.forEach(rc => { out[rc.label] = sectorByRange[rc.label]?.top7?.[i] ?? null })
          return out
        })
      : []
  }, [sectorByRange, activeSector.id])

  const hasRangeData = Object.keys(sectorByRange).length > 0
  const fade = { opacity: hasRangeData ? 1 : 0.4, transition: 'opacity 0.3s' }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isFavTab      = activeSector.id === 'favorites'
  const isScreenerTab = activeSector.id === 'screener'
  const isSectorTab   = !isFavTab && !isScreenerTab

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
            S&P 500 Sector Dashboard
          </h1>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
            Real-time · Top 7 holdings · Sector vs market
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <TickerSearch spyResult={spyResult1Y} onAddFavorite={handleToggleFav} favorites={favorites} />
          {lastUpdated && (
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{ fontSize:11, padding:'5px 12px', background:'var(--bg-secondary)', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', cursor: loading ? 'default' : 'pointer' }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <SectorTabs activeSector={activeSector} onChange={handleSectorChange} favCount={favorites.length} />

      {/* ── Screener view ── */}
      {isScreenerTab && (
        <StockScreener
          onTickerClick={sym => setModal({ type:'stock', sym, result:null })}
        />
      )}

      {/* ── Favorites view ── */}
      {isFavTab && (
        <FavoritesTab
          favorites={favorites}
          spRangeMap={spRangeMap}
          onToggleFav={handleToggleFav}
          onClickStock={(sym, result) => setModal({ type:'stock', sym, result })}
        />
      )}

      {/* ── Sector view ── */}
      {isSectorTab && (
        <>
          {/* Row 1: Ticker cards */}
          <div
            style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:8, marginBottom:12, ...fade }}
            className="ticker-row"
          >
            {(activeSector.top7 ?? []).map((sym, i) => (
              <TickerCard
                key={`${sym}-${activeSector.id}`}
                allRangeResults={cardRangeMaps[i] ?? {}}
                sym={sym}
                isFav={favorites.includes(sym)}
                onToggleFav={handleToggleFav}
                onClick={() => setModal({ type:'stock', sym, result: sectorByRange['1Y']?.top7?.[i] ?? null })}
              />
            ))}
            <TickerCard key="sp500" allRangeResults={spRangeMap} sym="S&P 500" isSP500 />
          </div>

          {/* Row 2: Momentum | Analysis | Sector breakdown */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12, ...fade }} className="mid-row">
            <SectorMomentumPanel
              top7Results={sectorByRange['1Y']?.top7 ?? []}
              activeSector={activeSector}
            />
            <SectorAnalysisPanel
              activeSector={activeSector}
              top7Results={sectorByRange['1Y']?.top7 ?? []}
              sectorResult={sectorByRange['1Y']?.etf ?? null}
              spyResult={spyResult1Y}
            />
            <SectorPanel activeSector={activeSector} />
          </div>

          {/* Row 3: ETF vs Market */}
          <div style={{ marginBottom:12, ...fade }}>
            <SectorVsMarketPanel
              allRangeData={sectorByRange}
              activeSector={activeSector}
              onExpand={() => setModal({
                type:'etf',
                sectorResult:  sectorByRange['1Y']?.etf ?? null,
                relatedResults:sectorByRange['1Y']?.related ?? [],
                spyResult:     spyResult1Y,
                activeSector,
              })}
            />
          </div>

          {/* Row 4: Sector heatmap | News */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12, ...fade }} className="mid-row">
            <SectorHeatmap
              sectorEtfResults={heatmapEtfs}
              spyResult={spyResult1Y}
              activeSector={activeSector}
              onSectorClick={handleSectorChange}
            />
            <NewsFeed syms={activeSector.top7 ?? []} activeSector={activeSector} />
          </div>

          {/* Row 5: All stocks heatmap */}
          <div style={{ ...fade }}>
            <AllStocksHeatmap
              allSectorData={allTop7Data}
              spyResult={spyResult1Y}
              onTickerClick={(sym, result) => setModal({ type:'stock', sym, result })}
            />
          </div>
        </>
      )}

      {/* Modal */}
      {modal && <ChartModal config={modal} onClose={() => setModal(null)} />}

      <style>{`
        @media (max-width:900px) { .ticker-row { grid-template-columns: repeat(4,minmax(0,1fr)) !important; } }
        @media (max-width:680px) {
          .ticker-row { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          .mid-row    { grid-template-columns: 1fr !important; }
          .bot-row    { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
