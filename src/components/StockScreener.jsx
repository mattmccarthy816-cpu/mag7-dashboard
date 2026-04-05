import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Panel from './Panel'
import { SP500_SYMBOLS } from '../sp500symbols'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMcap(v) {
  if (!v) return '—'
  if (v >= 1e12) return '$' + (v/1e12).toFixed(2) + 'T'
  if (v >= 1e9)  return '$' + (v/1e9).toFixed(1)  + 'B'
  return '$' + (v/1e6).toFixed(0) + 'M'
}
function fmtPE(v) { return v != null ? v.toFixed(1) : '—' }
function fmtPrice(v) { return v != null ? '$' + v.toFixed(2) : '—' }
function fmtPct(v) { return v != null ? (v>=0?'+':'')+v.toFixed(2)+'%' : '—' }

// Market cap tiers
const MCAP_TIERS = [
  { label:'All',            min:0,       max:Infinity },
  { label:'> $1T',          min:1e12,    max:Infinity },
  { label:'$500B – $1T',    min:500e9,   max:1e12     },
  { label:'$100B – $500B',  min:100e9,   max:500e9    },
  { label:'$10B – $100B',   min:10e9,    max:100e9    },
  { label:'< $10B',         min:0,       max:10e9     },
]

const PE_RANGES = [
  { label:'All',       min:null,  max:null  },
  { label:'< 15',      min:null,  max:15    },
  { label:'15 – 25',   min:15,    max:25    },
  { label:'25 – 50',   min:25,    max:50    },
  { label:'50 – 100',  min:50,    max:100   },
  { label:'> 100',     min:100,   max:null  },
  { label:'Negative',  min:null,  max:0     },
]

const PRICE_RANGES = [
  { label:'All',        min:0,    max:Infinity },
  { label:'< $50',      min:0,    max:50       },
  { label:'$50 – $150', min:50,   max:150      },
  { label:'$150 – $300',min:150,  max:300      },
  { label:'$300 – $500',min:300,  max:500      },
  { label:'> $500',     min:500,  max:Infinity },
]

const CHANGE_FILTERS = [
  { label:'All',      fn: () => true },
  { label:'↑ Up today',   fn: s => (s.changePercent ?? 0) > 0 },
  { label:'↓ Down today', fn: s => (s.changePercent ?? 0) < 0 },
  { label:'↑↑ +2% today', fn: s => (s.changePercent ?? 0) >= 2 },
  { label:'↓↓ -2% today', fn: s => (s.changePercent ?? 0) <= -2 },
]

const SORT_OPTIONS = [
  { label:'Market Cap ↓',  fn:(a,b)=>(b.marketCap??0)-(a.marketCap??0) },
  { label:'Market Cap ↑',  fn:(a,b)=>(a.marketCap??0)-(b.marketCap??0) },
  { label:'Price ↓',       fn:(a,b)=>(b.price??0)-(a.price??0) },
  { label:'Price ↑',       fn:(a,b)=>(a.price??0)-(b.price??0) },
  { label:'P/E ↓',         fn:(a,b)=>(b.trailingPE??Infinity)-(a.trailingPE??Infinity) },
  { label:'P/E ↑',         fn:(a,b)=>(a.trailingPE??Infinity)-(b.trailingPE??Infinity) },
  { label:'Change ↓',      fn:(a,b)=>(b.changePercent??-99)-(a.changePercent??-99) },
  { label:'Change ↑',      fn:(a,b)=>(a.changePercent??-99)-(b.changePercent??-99) },
  { label:'A–Z',           fn:(a,b)=>a.sym.localeCompare(b.sym) },
]

function FilterPill({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      fontSize:11, padding:'4px 11px', borderRadius:20, cursor:'pointer',
      fontWeight: active ? 600 : 400,
      background: active ? (color||'#4a8fd4')+'22' : 'var(--bg-secondary)',
      border: active ? `1px solid ${color||'#4a8fd4'}66` : '0.5px solid var(--border)',
      color: active ? (color||'#4a8fd4') : 'var(--text-secondary)',
      transition:'all 0.12s', whiteSpace:'nowrap',
    }}>{label}</button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function StockScreener({ onTickerClick }) {
  const [stocks, setStocks]       = useState([])
  const [loadState, setLoadState] = useState('idle') // idle | loading | done | error
  const [progress, setProgress]   = useState(0)
  const [searchQ, setSearchQ]     = useState('')

  // Filters
  const [mcapTier,    setMcapTier]    = useState(0)
  const [peRange,     setPeRange]     = useState(0)
  const [priceRange,  setPriceRange]  = useState(0)
  const [changeFilter,setChangeFilter]= useState(0)
  const [sortBy,      setSortBy]      = useState(0)
  const [sector,      setSector]      = useState('All')

  // Load all stocks
  const loadData = useCallback(async () => {
    setLoadState('loading')
    setProgress(0)
    setStocks([])

    const syms = SP500_SYMBOLS
    const CHUNK = 50
    const allResults = []

    for (let i = 0; i < syms.length; i += CHUNK) {
      const chunk = syms.slice(i, i + CHUNK)
      try {
        const res = await fetch(`/api/screen?symbols=${chunk.join(',')}`)
        if (res.ok) {
          const data = await res.json()
          allResults.push(...data)
          setStocks([...allResults])
        }
      } catch {}
      setProgress(Math.round(((i + CHUNK) / syms.length) * 100))
    }

    setLoadState('done')
    setProgress(100)
  }, [])

  // All sectors present in data
  const sectors = useMemo(() => {
    const s = new Set(stocks.map(st => st.sector).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [stocks])

  // Apply filters + sort
  const filtered = useMemo(() => {
    const mc = MCAP_TIERS[mcapTier]
    const pe = PE_RANGES[peRange]
    const pr = PRICE_RANGES[priceRange]
    const ch = CHANGE_FILTERS[changeFilter]
    const q  = searchQ.trim().toUpperCase()

    return stocks
      .filter(s => {
        if (q && !s.sym.includes(q) && !s.name?.toUpperCase().includes(q)) return false
        if (sector !== 'All' && s.sector !== sector) return false
        if (s.marketCap != null && (s.marketCap < mc.min || s.marketCap > mc.max)) return false
        if (pe.min != null && (s.trailingPE == null || s.trailingPE < pe.min)) return false
        if (pe.max != null && pe.max > 0 && (s.trailingPE == null || s.trailingPE > pe.max)) return false
        if (pe.max === 0 && (s.trailingPE == null || s.trailingPE >= 0)) return false
        if (s.price != null && (s.price < pr.min || s.price > pr.max)) return false
        if (!ch.fn(s)) return false
        return true
      })
      .sort(SORT_OPTIONS[sortBy].fn)
  }, [stocks, mcapTier, peRange, priceRange, changeFilter, sortBy, sector, searchQ])

  const activeFilterCount = [mcapTier,peRange,priceRange,changeFilter].filter(v=>v!==0).length
    + (sector !== 'All' ? 1 : 0)
    + (searchQ ? 1 : 0)

  const resetFilters = () => {
    setMcapTier(0); setPeRange(0); setPriceRange(0)
    setChangeFilter(0); setSortBy(0); setSector('All'); setSearchQ('')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Load trigger */}
      {loadState === 'idle' && (
        <Panel title="Stock Screener" badge="~200 S&P 500 stocks">
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'24px 0' }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)', textAlign:'center', lineHeight:1.6, maxWidth:400 }}>
              Filter S&P 500 stocks by market cap, P/E ratio, price, and daily change.
              Data loads once and filters update instantly.
            </div>
            <button onClick={loadData} style={{
              fontSize:13, fontWeight:600, padding:'10px 28px',
              background:'#4a8fd422', border:'1px solid #4a8fd466',
              borderRadius:8, color:'#4a8fd4', cursor:'pointer',
            }}>
              Load Screener Data
            </button>
          </div>
        </Panel>
      )}

      {/* Loading */}
      {loadState === 'loading' && (
        <Panel title="Stock Screener" badge="loading…">
          <div style={{ padding:'12px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
              <span>Fetching fundamentals…</span>
              <span>{stocks.length} loaded</span>
            </div>
            <div style={{ height:4, background:'var(--bg-secondary)', borderRadius:2 }}>
              <div style={{ height:4, background:'#4a8fd4', borderRadius:2, width:progress+'%', transition:'width 0.3s' }}/>
            </div>
            {/* Show partial results while loading */}
            {stocks.length > 0 && (
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
                Showing {stocks.length} stocks so far — filters will apply as more load
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Filters + results */}
      {(loadState === 'loading' || loadState === 'done') && stocks.length > 0 && (
        <Panel title="Stock Screener" badge={`${filtered.length} of ${stocks.length} stocks`}>
          {/* Search + sort row */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search ticker or name…"
              style={{
                flex:1, minWidth:140, fontSize:12, padding:'7px 11px',
                background:'var(--bg-secondary)', border:'0.5px solid var(--border-strong)',
                borderRadius:7, color:'var(--text-primary)', outline:'none',
              }}
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(Number(e.target.value))}
              style={{
                fontSize:11, padding:'7px 10px',
                background:'var(--bg-secondary)', border:'0.5px solid var(--border-strong)',
                borderRadius:7, color:'var(--text-secondary)', cursor:'pointer', outline:'none',
              }}
            >
              {SORT_OPTIONS.map((o,i) => <option key={i} value={i}>{o.label}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} style={{
                fontSize:11, padding:'7px 12px',
                background:'rgba(224,80,80,0.1)', border:'0.5px solid rgba(224,80,80,0.3)',
                borderRadius:7, color:'#e05050', cursor:'pointer',
              }}>
                ✕ Clear {activeFilterCount} filter{activeFilterCount!==1?'s':''}
              </button>
            )}
          </div>

          {/* Market Cap */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Market Cap</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {MCAP_TIERS.map((t,i) => <FilterPill key={t.label} label={t.label} active={mcapTier===i} onClick={()=>setMcapTier(i)} color="#4a8fd4"/>)}
            </div>
          </div>

          {/* P/E Ratio */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>P/E Ratio (trailing)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {PE_RANGES.map((t,i) => <FilterPill key={t.label} label={t.label} active={peRange===i} onClick={()=>setPeRange(i)} color="#e8a835"/>)}
            </div>
          </div>

          {/* Price Range */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Price</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {PRICE_RANGES.map((t,i) => <FilterPill key={t.label} label={t.label} active={priceRange===i} onClick={()=>setPriceRange(i)} color="#9b7de0"/>)}
            </div>
          </div>

          {/* Daily Change */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Today's Move</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {CHANGE_FILTERS.map((t,i) => <FilterPill key={t.label} label={t.label} active={changeFilter===i} onClick={()=>setChangeFilter(i)}
                color={i===0?'#888':i<=2?'#1fb87a':'#1fb87a'}/>)}
            </div>
          </div>

          {/* Sector */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Sector</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {sectors.map(s => <FilterPill key={s} label={s} active={sector===s} onClick={()=>setSector(s)} color="#4ab8b8"/>)}
            </div>
          </div>

          {/* Results table */}
          {filtered.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--text-muted)', padding:'20px 0', textAlign:'center' }}>
              No stocks match these filters.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'0.5px solid var(--border)' }}>
                    {['Ticker','Name','Price','Change','Market Cap','P/E','Fwd P/E','Sector'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:10, fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((s, i) => {
                    const isUp = (s.changePercent ?? 0) >= 0
                    return (
                      <tr
                        key={s.sym}
                        onClick={() => onTickerClick?.(s.sym)}
                        style={{
                          borderBottom:'0.5px solid var(--border)',
                          cursor:'pointer',
                          background: i%2===0?'transparent':'rgba(255,255,255,0.015)',
                          transition:'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,0.015)'}
                      >
                        <td style={{ padding:'7px 8px', fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap' }}>{s.sym}</td>
                        <td style={{ padding:'7px 8px', color:'var(--text-secondary)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</td>
                        <td style={{ padding:'7px 8px', color:'var(--text-primary)', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{fmtPrice(s.price)}</td>
                        <td style={{ padding:'7px 8px', color:isUp?'#1fb87a':'#e05050', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{fmtPct(s.changePercent)}</td>
                        <td style={{ padding:'7px 8px', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{fmtMcap(s.marketCap)}</td>
                        <td style={{ padding:'7px 8px', color:'var(--text-secondary)', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{fmtPE(s.trailingPE)}</td>
                        <td style={{ padding:'7px 8px', color:'var(--text-secondary)', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{fmtPE(s.forwardPE)}</td>
                        <td style={{ padding:'7px 8px', color:'var(--text-muted)', whiteSpace:'nowrap', fontSize:10 }}>{s.sector ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length > 100 && (
                <div style={{ fontSize:11, color:'var(--text-muted)', padding:'10px 8px' }}>
                  Showing top 100 of {filtered.length} matches — refine filters to narrow results
                </div>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
