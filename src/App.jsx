import React, { useState, useEffect, useCallback, useRef } from 'react'
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

const REFRESH_MS = 60_000
const FAV_KEY = 'dashboard_favorites'
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)||'[]') } catch { return [] } }
const saveFavs = f => { try { localStorage.setItem(FAV_KEY,JSON.stringify(f)) } catch {} }

// Range configs to prefetch
const RANGE_CONFIGS = [
  { label:'1D', range:'1d',  interval:'5m'  },
  { label:'1W', range:'5d',  interval:'15m' },
  { label:'1M', range:'1mo', interval:'1d'  },
  { label:'3M', range:'3mo', interval:'1d'  },
  { label:'1Y', range:'1y',  interval:'1d'  },
]

export default function App() {
  const [activeSector, setActiveSector] = useState(SECTORS[0])

  // Base data per range: { '1Y': { sp, spy }, '1D': {...}, ... }
  const [baseByRange, setBaseByRange]   = useState({})
  // Sector data per range: { '1Y': { top7, etf, related }, ... }
  const [sectorByRange, setSectorByRange] = useState({})

  const [lastUpdated, setLastUpdated]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const [sectorLoading, setSectorLoading] = useState(false)
  const sectorCache = useRef({}) // key: `${sectorId}|${rangeLabel}`

  const [favorites, setFavorites] = useState(loadFavs)
  const [favData, setFavData]     = useState({})
  const [modal, setModal]         = useState(null)

  // Fetch base (SP500 + SPY) for all ranges
  const fetchAllBase = useCallback(async () => {
    const results = await Promise.all(
      RANGE_CONFIGS.map(rc => fetchYahooMany(['^GSPC','SPY'], rc.range, rc.interval))
    )
    const byRange = {}
    RANGE_CONFIGS.forEach((rc,i) => {
      byRange[rc.label] = { sp: results[i][0], spy: results[i][1] }
    })
    setBaseByRange(byRange)
  }, [])

  // Fetch sector data for all ranges
  const fetchAllSector = useCallback(async (sector, force=false) => {
    setSectorLoading(true)
    const newByRange = {}
    await Promise.all(
      RANGE_CONFIGS.map(async rc => {
        const key = `${sector.id}|${rc.label}`
        if (!force && sectorCache.current[key]) {
          newByRange[rc.label] = sectorCache.current[key]
          return
        }
        const syms = [...sector.top7, sector.etf, ...sector.relatedEtfs]
        const results = await fetchYahooMany(syms, rc.range, rc.interval)
        const data = {
          top7:    results.slice(0, 7),
          etf:     results[7],
          related: results.slice(8, 8 + sector.relatedEtfs.length),
          spy:     null, // filled from baseByRange
        }
        sectorCache.current[key] = data
        newByRange[rc.label] = data
      })
    )
    // Merge spy from base into each range
    setSectorByRange(prev => {
      const merged = {}
      RANGE_CONFIGS.forEach(rc => {
        merged[rc.label] = {
          ...(newByRange[rc.label] || prev[rc.label] || {}),
          spy: baseByRange[rc.label]?.spy ?? null,
        }
      })
      return merged
    })
    setSectorLoading(false)
  }, [baseByRange])

  // Re-merge spy whenever base loads
  useEffect(() => {
    if (!Object.keys(baseByRange).length) return
    setSectorByRange(prev => {
      if (!Object.keys(prev).length) return prev
      const merged = {}
      RANGE_CONFIGS.forEach(rc => {
        merged[rc.label] = { ...(prev[rc.label]||{}), spy: baseByRange[rc.label]?.spy ?? null }
      })
      return merged
    })
  }, [baseByRange])

  // Favorites
  useEffect(() => {
    if (!favorites.length) return
    fetchYahooMany(favorites, '1y', '1d').then(results => {
      const map = {}
      favorites.forEach((sym,i) => { map[sym] = results[i] })
      setFavData(map)
    })
  }, [favorites])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchAllBase()
      setLastUpdated(new Date())
      setLoading(false)
    }
    init()
    const id = setInterval(() => {
      sectorCache.current = {}
      fetchAllBase()
      if (activeSector.id !== 'favorites') fetchAllSector(activeSector, true)
      setLastUpdated(new Date())
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  // Fetch sector when base ready or sector changes
  const prevSectorId = useRef(null)
  useEffect(() => {
    if (!Object.keys(baseByRange).length) return
    if (activeSector.id === 'favorites') return
    if (prevSectorId.current === activeSector.id && Object.keys(sectorByRange).length) return
    prevSectorId.current = activeSector.id
    fetchAllSector(activeSector)
  }, [activeSector.id, Object.keys(baseByRange).length])

  const handleSectorChange = useCallback((sector) => {
    setActiveSector(sector)
    if (sector.id !== 'favorites') {
      prevSectorId.current = null // force refetch check
    }
  }, [])

  const handleToggleFav = useCallback((sym) => {
    setFavorites(prev => {
      const next = prev.includes(sym) ? prev.filter(s=>s!==sym) : [...prev,sym]
      saveFavs(next); return next
    })
  }, [])

  const handleRefresh = async () => {
    setLoading(true); sectorCache.current = {}
    await fetchAllBase()
    if (activeSector.id !== 'favorites') await fetchAllSector(activeSector, true)
    setLastUpdated(new Date()); setLoading(false)
  }

  const isFavTab = activeSector.id === 'favorites'
  const fade = { opacity: sectorLoading ? 0.45 : 1, transition: 'opacity 0.2s' }
  const spResult1Y = baseByRange['1Y']?.sp ?? null
  const spyResult1Y = baseByRange['1Y']?.spy ?? null

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:600,color:'var(--text-primary)',letterSpacing:'-0.02em'}}>S&P 500 Sector Dashboard</h1>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Real-time · Top 7 holdings · Sector vs market</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <TickerSearch
            spyResult={spyResult1Y}
            onAddFavorite={handleToggleFav}
            favorites={favorites}
          />
          {lastUpdated&&<span style={{fontSize:11,color:'var(--text-muted)'}}>Updated {lastUpdated.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button onClick={handleRefresh} disabled={loading} style={{fontSize:11,padding:'5px 12px',background:'var(--bg-secondary)',border:'0.5px solid var(--border-strong)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:loading?'default':'pointer'}}>
            {loading?'Refreshing…':'↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Sector tabs */}
      <SectorTabs activeSector={activeSector} onChange={handleSectorChange} favCount={favorites.length}/>

      {isFavTab ? (
        <FavoritesTab
          favorites={favorites} favData={favData} spResult={spResult1Y} onToggleFav={handleToggleFav}
          onClickStock={(sym,result)=>setModal({type:'stock',sym,result})}
        />
      ) : (
        <>
          {/* Row 1: Ticker cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:12,...fade}} className="ticker-row">
            {activeSector.top7.map((sym,i)=>(
              <TickerCard key={sym} result={sectorByRange['1Y']?.top7?.[i]??null} sym={sym}
                isFav={favorites.includes(sym)} onToggleFav={handleToggleFav}
                onClick={()=>setModal({type:'stock',sym,result:sectorByRange['1Y']?.top7?.[i]??null})}
              />
            ))}
            <TickerCard result={spResult1Y} sym="S&P 500" name="^GSPC" isSP500/>
          </div>

          {/* Row 2: Momentum | Analysis | Sectors */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12,...fade}} className="mid-row">
            <SectorMomentumPanel top7Results={sectorByRange['1Y']?.top7??[]} activeSector={activeSector}/>
            <SectorAnalysisPanel
              activeSector={activeSector}
              top7Results={sectorByRange['1Y']?.top7??[]}
              sectorResult={sectorByRange['1Y']?.etf??null}
              spyResult={spyResult1Y}
            />
            <SectorPanel activeSector={activeSector}/>
          </div>

          {/* Row 3: ETF vs Market | Top 7 mcap share */}
          <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:12,...fade}} className="bot-row">
            <SectorVsMarketPanel
              allRangeData={sectorByRange}
              activeSector={activeSector}
              onExpand={()=>setModal({type:'etf',sectorResult:sectorByRange['1Y']?.etf??null,relatedResults:sectorByRange['1Y']?.related??[],spyResult:spyResult1Y,activeSector})}
            />
            <Top7McapPanel
              allRangeData={sectorByRange}
              activeSector={activeSector}
            />
          </div>
        </>
      )}

      {modal&&<ChartModal config={modal} onClose={()=>setModal(null)}/>}

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
