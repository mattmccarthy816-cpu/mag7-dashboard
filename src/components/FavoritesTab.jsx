import React, { useState, useEffect } from 'react'
import TickerCard from './TickerCard'
import { fetchYahooMany } from '../api'

const RANGE_CONFIGS = [
  { label:'1D', range:'1d',  interval:'5m'  },
  { label:'1W', range:'5d',  interval:'15m' },
  { label:'1M', range:'1mo', interval:'1d'  },
  { label:'3M', range:'3mo', interval:'1d'  },
  { label:'1Y', range:'1y',  interval:'1d'  },
]

export default function FavoritesTab({ favorites, spResult, onToggleFav, onClickStock }) {
  // allRangeData: { sym: { '1D': result, '1W': result, ... } }
  const [allRangeData, setAllRangeData] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!favorites.length) return
    setLoading(true)

    Promise.all(
      RANGE_CONFIGS.map(rc =>
        fetchYahooMany(favorites, rc.range, rc.interval).then(results => ({ label: rc.label, results }))
      )
    ).then(allRanges => {
      const map = {}
      favorites.forEach((sym, i) => {
        map[sym] = {}
        allRanges.forEach(({ label, results }) => {
          map[sym][label] = results[i] ?? null
        })
      })
      setAllRangeData(map)
      setLoading(false)
    })
  }, [favorites.join(',')])

  // S&P 500 ranges
  const [spRanges, setSpRanges] = useState({})
  useEffect(() => {
    Promise.all(
      RANGE_CONFIGS.map(rc =>
        fetchYahooMany(['^GSPC'], rc.range, rc.interval).then(r => ({ label: rc.label, result: r[0] }))
      )
    ).then(ranges => {
      const map = {}
      ranges.forEach(({ label, result }) => { map[label] = result })
      setSpRanges(map)
    })
  }, [])

  if (favorites.length === 0) {
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
        <div style={{ fontSize:12, color:'var(--text-muted)', padding:'12px 0', marginBottom:8 }}>
          Loading range data for favorites…
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:8, marginBottom:12 }} className="ticker-row">
        {favorites.map(sym => (
          <TickerCard
            key={sym}
            allRangeResults={allRangeData[sym] ?? { '1D':null,'1W':null,'1M':null,'3M':null,'1Y':null }}
            sym={sym}
            isFav
            onToggleFav={onToggleFav}
            onClick={() => onClickStock?.(sym, allRangeData[sym]?.['1Y'] ?? null)}
          />
        ))}
        <TickerCard allRangeResults={spRanges} sym="S&P 500" isSP500 />
      </div>
      <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)', padding:'12px 16px', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)' }}>
        {favorites.length} favorited stock{favorites.length!==1?'s':''} · All time ranges available · Click any card to expand
      </div>
    </div>
  )
}
