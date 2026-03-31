import React, { useState, useEffect, useRef } from 'react'
import TickerCard from './TickerCard'
import { fetchYahooMany } from '../api'

const RANGE_CONFIGS = [
  { label:'1D', range:'1d',  interval:'5m'  },
  { label:'1W', range:'5d',  interval:'15m' },
  { label:'1M', range:'1mo', interval:'1d'  },
  { label:'3M', range:'3mo', interval:'1d'  },
  { label:'1Y', range:'1y',  interval:'1d'  },
]

const EMPTY_RANGES = { '1D':null,'1W':null,'1M':null,'3M':null,'1Y':null }

export default function FavoritesTab({ favorites = [], spRangeMap = {}, onToggleFav, onClickStock }) {
  const [allRangeData, setAllRangeData] = useState({})
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!favorites || favorites.length === 0) { setAllRangeData({}); return }
    setLoading(true)

    Promise.all(
      RANGE_CONFIGS.map(rc =>
        fetchYahooMany(favorites, rc.range, rc.interval)
          .then(results => ({ label: rc.label, results }))
          .catch(() => ({ label: rc.label, results: favorites.map(() => null) }))
      )
    ).then(allRanges => {
      if (!mountedRef.current) return
      const map = {}
      favorites.forEach((sym, i) => {
        map[sym] = {}
        allRanges.forEach(({ label, results }) => {
          map[sym][label] = results?.[i] ?? null
        })
      })
      setAllRangeData(map)
      setLoading(false)
    }).catch(() => { if (mountedRef.current) setLoading(false) })
  }, [(favorites || []).join(',')])

  if (!favorites || favorites.length === 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', gap:12, color:'var(--text-muted)', textAlign:'center' }}>
        <div style={{ fontSize:32, opacity:0.3 }}>♡</div>
        <div style={{ fontSize:14, fontWeight:500 }}>No favorites yet</div>
        <div style={{ fontSize:12 }}>Click the heart on any stock card to add it here</div>
      </div>
    )
  }

  return (
    <div>
      {loading && (
        <div style={{ fontSize:11, color:'var(--text-muted)', padding:'8px 0', marginBottom:4 }}>
          Fetching all time ranges…
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:8, marginBottom:12 }} className="ticker-row">
        {favorites.map(sym => (
          <TickerCard
            key={`fav-${sym}`}
            allRangeResults={allRangeData[sym] ?? EMPTY_RANGES}
            sym={sym}
            isFav
            onToggleFav={onToggleFav}
            onClick={() => onClickStock?.(sym, allRangeData[sym]?.['1Y'] ?? null)}
          />
        ))}
        <TickerCard
          key="fav-sp500"
          allRangeResults={spRangeMap && Object.keys(spRangeMap).length > 0 ? spRangeMap : EMPTY_RANGES}
          sym="S&P 500"
          isSP500
        />
      </div>
      <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)', padding:'12px 16px', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)' }}>
        {favorites.length} favorited stock{favorites.length !== 1 ? 's' : ''} · All time ranges available · Click any card to expand
      </div>
    </div>
  )
}
