import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchYahooMany } from './api'
import { SECTORS } from './constants'
import SectorTabs from './components/SectorTabs'
import TickerCard from './components/TickerCard'
import SectorMomentumPanel from './components/SectorMomentumPanel'
import SectorPanel from './components/SectorPanel'
import SectorVsMarketPanel from './components/SectorVsMarketPanel'
import Top7McapPanel from './components/Top7McapPanel'
import SectorAnalysisPanel from './components/SectorAnalysisPanel'
import FavoritesTab from './components/FavoritesTab'
import ChartModal from './components/ChartModal'
import TickerSearch from './components/TickerSearch'
import EarningsCalendar from './components/EarningsCalendar'
import SectorHeatmap from './components/SectorHeatmap'
import NewsFeed from './components/NewsFeed'
import AllStocksHeatmap from './components/AllStocksHeatmap'

const REFRESH_MS = 60_000
const FAV_KEY    = 'dashboard_favorites'
const loadFavs   = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)||'[]') } catch { return [] } }
const saveFavs   = f  => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)) } catch {} }

const RANGE_CONFIGS = [
  { label:'1D', range:'1d',  interval:'5m'  },
  { label:'1W', range:'5d',  interval:'15m' },
  { label:'1M', range:'1mo', interval:'1d'  },
  { label:'3M', range:'3mo', interval:'1d'  },
  { label:'1Y', range:'1y',  interval:'1d'  },
]

export default function App() {
  const [activeSector, setActiveSector]   = useState(SECTORS[0])

  // sectorByRange: { '1D': { top7, etf, related, spy }, '1W': ..., ... }
  // Each range is populated independently as it arrives — no race condition
  const [sectorByRange, setSectorByRange] = useState({})
  const [baseByRange, setBaseByRange]     = useState({})
  const [heatmapEtfs, setHeatmapEtfs]    = useState({})
  const [allTop7Data, setAllTop7Data]     = useState({})
  const [lastUpdated, setLastUpdated]     = useState(null)
  const [loading, setLoading]             = useState(true)
  const sectorCache = useRef({})
  const prevSectorId = useRef(null)
  const [favorites, setFavorites] = useState(loadFavs)
  const [modal, setModal]         = useState(null)

  // Fetch base (GSPC + SPY) one range at a time, updating state as each arrives
  const fetchAllBase = useCallback(async () => {
    const allResults = await Promise.all(
      RANGE_CONFIGS.map(rc => fetchYahooMany(['^GSPC','SPY'], rc.range, rc.interval))
    )
    const byRange = {}
    RANGE_CONFIGS.forEach((rc,i) => {
      byRange[rc.label] = { sp: allResults[i][0], spy: allResults[i][1] }
    })
    setBaseByRange(byRange)
    return byRange
  }, [])

  const fetchHeatmapData = useCallback(async () => {
    const etfSyms = SECTORS.map(s => s.etf)
    const etfResults = await fetchYahooMany(etfSyms, '1y', '1d')
    const etfMap = {}
    SECTORS.forEach((s,i) => { etfMap[s.id] = etfResults[i] })
    setHeatmapEtfs(etfMap)

    const allSyms = SECTORS.flatMap(s => s.top7)
    const allResults = await fetchYahooMany(allSyms, '1y', '1d')
    const allTop7Map = {}
    let idx = 0
    SECTORS.forEach(s => {
      allTop7Map[s.id] = allResults.slice(idx, idx + s.top7.length)
      idx += s.top7.length
    })
    setAllTop7Data(allTop7Map)
  }, [])

  // Fetch each range independently, updating state as each one arrives
  const fetchAllSector = useCallback(async (sector, base, force=false) => {
    // Clear existing sector data immediately so components show loading state
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
      // Update this specific range immediately as it arrives
      setSectorByRange(prev => ({ ...prev, [rc.label]: data }))
    }))
  }, [])

  // Init
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
      if (activeSector.id !== 'favorites') fetchAllSector(activeSector, base, true)
      fetchHeatmapData()
      setLastUpdated(new Date())
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const handleSectorChange = useCallback((sector) => {
    setActiveSector(sector)
    if (sector.id !== 'favorites' && sector.id !== prevSectorId.current) {
      prevSectorId.current = sector.id
      fetchAllBase().then(base => fetchAllSector(sector, base))
    }
  }, [fetchAllBase, fetchAllSector])

  const handleToggleFav = useCallback((sym) => {
    setFavorites(prev => {
      const next = prev.includes(sym) ? prev.filter(s=>s!==sym) : [...prev,sym]
      saveFavs(next); return next
    })
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    sectorCache.current = {}
    const base = await fetchAllBase()
    await Promise.all([
      activeSector.id !== 'favorites' ? fetchAllSector(activeSector, base, true) : Promise.resolve(),
      fetchHeatmapData(),
    ])
    setLastUpdated(new Date())
    setLoading(false)
  }

  const isFavTab     = activeSector.id === 'favorites'
  const fade         = { opacity: Object.keys(sectorByRange).length === 0 ? 0.4 : 1, transition: 'opacity 0.3s' }
  const spResult1Y   = baseByRange['1Y']?.sp  ?? null
  const spyResult1Y  = baseByRange['1Y']?.spy ?? null

  // Memoize per-card range maps so they don't recreate every render
  const cardRangeMaps = useMemo(() => {
    return activeSector.top7.map((_, i) => {
      const out = {}
      RANGE_CONFIGS.forEach(rc => { out[rc.label] = sectorByRange[rc.label]?.top7?.[i] ?? null })
      return out
    })
  }, [sectorByRange, activeSector.id])

  const spRangeMap = useMemo(() => {
    const out = {}
    RANGE_CONFIGS.forEach(rc => { out[rc.label] = baseByRange[rc.label]?.sp ?? null })
    return out
  }, [baseByRange])

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:600,color:'var(--text-primary)',letterSpacing:'-0.02em'}}>S&P 500 Sector Dashboard</h1>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Real-time · Top 7 holdings · Sector vs market</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <TickerSearch spyResult={spyResult1Y} onAddFavorite={handleToggleFav} favorites={favorites}/>
          {lastUpdated && <span style={{fontSize:11,color:'var(--text-muted)'}}>Updated {lastUpdated.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button onClick={handleRefresh} disabled={loading} style={{fontSize:11,padding:'5px 12px',background:'var(--bg-secondary)',border:'0.5px solid var(--border-strong)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:loading?'default':'pointer'}}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <SectorTabs activeSector={activeSector} onChange={handleSectorChange} favCount={favorites.length}/>

      {isFavTab ? (
        <FavoritesTab
          favorites={favorites}
          spResult={spResult1Y}
          onToggleFav={handleToggleFav}
          onClickStock={(sym,result) => setModal({type:'stock',sym,result})}
        />
      ) : (
        <>
          {/* Row 1: Ticker cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:12,...fade}} className="ticker-row">
            {activeSector.top7.map((sym, i) => (
              <TickerCard
                key={`${sym}-${activeSector.id}`}
                allRangeResults={cardRangeMaps[i]}
                sym={sym}
                isFav={favorites.includes(sym)}
                onToggleFav={handleToggleFav}
                onClick={() => setModal({type:'stock', sym, result: sectorByRange['1Y']?.top7?.[i] ?? null})}
              />
            ))}
            <TickerCard key="sp500" allRangeResults={spRangeMap} sym="S&P 500" isSP500/>
          </div>

          {/* Row 2 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12,...fade}} className="mid-row">
            <SectorMomentumPanel top7Results={sectorByRange['1Y']?.top7 ?? []} activeSector={activeSector}/>
            <SectorAnalysisPanel
              activeSector={activeSector}
              top7Results={sectorByRange['1Y']?.top7 ?? []}
              sectorResult={sectorByRange['1Y']?.etf ?? null}
              spyResult={spyResult1Y}
            />
            <SectorPanel activeSector={activeSector}/>
          </div>

          {/* Row 3 */}
          <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:12,marginBottom:12,...fade}} className="bot-row">
            <SectorVsMarketPanel
              allRangeData={sectorByRange}
              activeSector={activeSector}
              onExpand={() => setModal({type:'etf', sectorResult:sectorByRange['1Y']?.etf??null, relatedResults:sectorByRange['1Y']?.related??[], spyResult:spyResult1Y, activeSector})}
            />
            <Top7McapPanel allRangeData={sectorByRange} activeSector={activeSector}/>
          </div>

          {/* Row 4 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12,...fade}} className="mid-row">
            <SectorHeatmap sectorEtfResults={heatmapEtfs} spyResult={spyResult1Y} activeSector={activeSector} onSectorClick={handleSectorChange}/>
            <EarningsCalendar syms={activeSector.top7} activeSector={activeSector}/>
            <NewsFeed syms={activeSector.top7} activeSector={activeSector}/>
          </div>

          {/* Row 5: All stocks heatmap */}
          <div style={{...fade}}>
            <AllStocksHeatmap allSectorData={allTop7Data} onTickerClick={(sym,result) => setModal({type:'stock',sym,result})}/>
          </div>
        </>
      )}

      {modal && <ChartModal config={modal} onClose={() => setModal(null)}/>}

      <style>{`
        @media (max-width:900px){.ticker-row{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
        @media (max-width:680px){
          .ticker-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .mid-row{grid-template-columns:1fr!important}
          .bot-row{grid-template-columns:1fr!important}
        }
      `}</style>
    </div>
  )
}
