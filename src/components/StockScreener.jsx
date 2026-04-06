import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { SP500_SYMBOLS } from '../sp500symbols'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtMcap  = v => { if(v==null)return'—'; if(v>=1e12)return'$'+(v/1e12).toFixed(2)+'T'; if(v>=1e9)return'$'+(v/1e9).toFixed(1)+'B'; return'$'+(v/1e6).toFixed(0)+'M' }
const fmtPct   = v => v!=null ? (v>=0?'+':'')+v.toFixed(2)+'%' : '—'
const fmtPrice = v => v!=null ? '$'+v.toFixed(2) : '—'
const fmtPE    = v => v!=null && isFinite(v) && v > -1000 && v < 10000 ? v.toFixed(1) : '—'
const pctColor = v => v==null?'var(--text-muted)':v>=0?'#1fb87a':'#e05050'
const RATING_COLOR = { strong_buy:'#1fb87a', buy:'#7ab87a', hold:'#e8a835', sell:'#e07840', strong_sell:'#e05050' }
const RATING_LABEL = { strong_buy:'Strong Buy', buy:'Buy', hold:'Hold', sell:'Sell', strong_sell:'Strong Sell' }
const rColor = r => RATING_COLOR[r] ?? 'var(--text-muted)'
const rLabel = r => RATING_LABEL[r] ?? r ?? '—'

// ── Filter definitions — each is a Set of active indices (multi-select) ───────
const MCAP_OPTS = [
  { label:'Mega (>$1T)',      test: s => s.marketCap != null && s.marketCap >= 1e12 },
  { label:'Large ($100B–$1T)',test: s => s.marketCap != null && s.marketCap >= 100e9 && s.marketCap < 1e12 },
  { label:'Mid ($10–100B)',   test: s => s.marketCap != null && s.marketCap >= 10e9  && s.marketCap < 100e9 },
  { label:'Small (<$10B)',    test: s => s.marketCap != null && s.marketCap < 10e9 },
]
const PE_OPTS = [
  { label:'< 15',      test: s => s.trailingPE != null && s.trailingPE > 0 && s.trailingPE < 15 },
  { label:'15 – 25',   test: s => s.trailingPE != null && s.trailingPE >= 15 && s.trailingPE <= 25 },
  { label:'25 – 50',   test: s => s.trailingPE != null && s.trailingPE > 25 && s.trailingPE <= 50 },
  { label:'50 – 100',  test: s => s.trailingPE != null && s.trailingPE > 50 && s.trailingPE <= 100 },
  { label:'> 100',     test: s => s.trailingPE != null && s.trailingPE > 100 },
  { label:'Negative',  test: s => s.trailingPE != null && s.trailingPE < 0 },
  { label:'N/A',       test: s => s.trailingPE == null },
]
const PRICE_OPTS = [
  { label:'< $50',       test: s => s.price != null && s.price < 50 },
  { label:'$50 – $150',  test: s => s.price != null && s.price >= 50   && s.price < 150 },
  { label:'$150 – $300', test: s => s.price != null && s.price >= 150  && s.price < 300 },
  { label:'$300 – $500', test: s => s.price != null && s.price >= 300  && s.price < 500 },
  { label:'> $500',      test: s => s.price != null && s.price >= 500 },
]
const RATING_OPTS = [
  { label:'Strong Buy',  test: s => s.analystRating === 'strong_buy' },
  { label:'Buy',         test: s => s.analystRating === 'buy' },
  { label:'Hold',        test: s => s.analystRating === 'hold' },
  { label:'Sell',        test: s => s.analystRating === 'sell' || s.analystRating === 'strong_sell' },
]
const CHANGE_PERIODS = ['1D','1M','1Y']

const SORT_OPTIONS = [
  { label:'Mkt Cap ↓',  fn:(a,b)=>(b.marketCap??0)-(a.marketCap??0) },
  { label:'Mkt Cap ↑',  fn:(a,b)=>(a.marketCap??0)-(b.marketCap??0) },
  { label:'Price ↓',    fn:(a,b)=>(b.price??0)-(a.price??0) },
  { label:'Price ↑',    fn:(a,b)=>(a.price??0)-(b.price??0) },
  { label:'P/E ↓',      fn:(a,b)=>(b.trailingPE??Infinity)-(a.trailingPE??Infinity) },
  { label:'P/E ↑',      fn:(a,b)=>(a.trailingPE??Infinity)-(b.trailingPE??Infinity) },
  { label:'1D ↓',       fn:(a,b)=>(b.chg1D??-99)-(a.chg1D??-99) },
  { label:'1D ↑',       fn:(a,b)=>(a.chg1D??99)-(b.chg1D??99) },
  { label:'1M ↓',       fn:(a,b)=>(b.chg1M??-99)-(a.chg1M??-99) },
  { label:'1Y ↓',       fn:(a,b)=>(b.chg1Y??-99)-(a.chg1Y??-99) },
  { label:'A – Z',      fn:(a,b)=>a.sym.localeCompare(b.sym) },
]

// ── Multi-select Pill ─────────────────────────────────────────────────────────
function Pill({ label, active, onClick, color = '#4a8fd4' }) {
  return (
    <button onClick={onClick} style={{
      fontSize:11, padding:'4px 11px', borderRadius:20, cursor:'pointer',
      fontWeight: active ? 600 : 400,
      background: active ? color+'33' : 'var(--bg-secondary)',
      border: active ? `1.5px solid ${color}88` : '0.5px solid var(--border)',
      color: active ? color : 'var(--text-secondary)',
      transition:'all 0.1s', whiteSpace:'nowrap',
    }}>{label}</button>
  )
}

// ── Filter group (multi-select set) ──────────────────────────────────────────
function FilterGroup({ label, opts, active, onToggle, color }) {
  const count = active.size
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:6 }}>
        {label}
        {count > 0 && <span style={{ fontSize:9, background:color+'33', color, border:`1px solid ${color}66`, borderRadius:8, padding:'1px 6px' }}>{count} selected</span>}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        {opts.map((o, i) => (
          <Pill key={o.label} label={o.label} active={active.has(i)} onClick={() => onToggle(i)} color={color}/>
        ))}
      </div>
    </div>
  )
}

// ── Stock detail drawer ───────────────────────────────────────────────────────
function StockDetail({ stock, onClose }) {
  const [fin, setFin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setFin(null)
    fetch(`/api/financials?symbol=${stock.sym}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setFin(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [stock.sym])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'min(500px,100vw)', height:'100vh', overflowY:'auto', background:'#16161a', borderLeft:'0.5px solid rgba(255,255,255,0.12)', padding:'22px 18px' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#f0f0f2' }}>{stock.sym}</div>
            <div style={{ fontSize:12, color:'#555', marginTop:2 }}>{stock.name}</div>
            {stock.sector && <div style={{ fontSize:10, color:'#444', marginTop:1 }}>{stock.sector}{stock.industry ? ` · ${stock.industry}` : ''}</div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:8, width:30, height:30, color:'#888', fontSize:15, cursor:'pointer' }}>✕</button>
        </div>

        {/* Snapshot grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:16 }}>
          {[
            { l:'Price',     v:fmtPrice(stock.price),    c:'#f0f0f2' },
            { l:'Today',     v:fmtPct(stock.chg1D),      c:pctColor(stock.chg1D) },
            { l:'1 Month',   v:fmtPct(stock.chg1M),      c:pctColor(stock.chg1M) },
            { l:'1 Year',    v:fmtPct(stock.chg1Y),      c:pctColor(stock.chg1Y) },
            { l:'Mkt Cap',   v:fmtMcap(stock.marketCap), c:'#f0f0f2' },
            { l:'P/E (ttm)', v:fmtPE(stock.trailingPE),  c:'#f0f0f2' },
            { l:'Fwd P/E',   v:fmtPE(stock.forwardPE),   c:'#f0f0f2' },
            { l:'EPS (ttm)', v:stock.eps!=null?'$'+stock.eps.toFixed(2):'—', c:'#f0f0f2' },
            { l:'52w',       v:stock.week52Low&&stock.week52High ? `$${stock.week52Low.toFixed(0)} – $${stock.week52High.toFixed(0)}` : '—', c:'#f0f0f2' },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:'rgba(255,255,255,0.04)', borderRadius:7, padding:'8px 10px' }}>
              <div style={{ fontSize:9, color:'#444', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600, color:c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Analyst consensus */}
        {stock.analystRating && (
          <div style={{ marginBottom:14, padding:'11px 13px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:`0.5px solid ${rColor(stock.analystRating)}44` }}>
            <div style={{ fontSize:9, color:'#444', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Analyst Consensus</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:17, fontWeight:700, color:rColor(stock.analystRating) }}>{rLabel(stock.analystRating)}</span>
              {stock.analystCount && <span style={{ fontSize:11, color:'#555' }}>{stock.analystCount} analysts</span>}
              {stock.targetPrice && <span style={{ fontSize:12, color:'#f0f0f2' }}>Target: {fmtPrice(stock.targetPrice)}</span>}
            </div>
            {/* Analyst bar breakdown */}
            {fin?.financials && (() => {
              const f = fin.financials
              const segs = [
                {l:'Strong Buy', v:f.strongBuy??0, c:'#1fb87a'},
                {l:'Buy',        v:f.buy??0,       c:'#7ab87a'},
                {l:'Hold',       v:f.hold??0,      c:'#e8a835'},
                {l:'Sell',       v:f.sell??0,      c:'#e07840'},
                {l:'Strong Sell',v:f.strongSell??0,c:'#e05050'},
              ].filter(x=>x.v>0)
              const total = segs.reduce((s,x)=>s+x.v,0)
              if(!total) return null
              return (
                <div style={{marginTop:10}}>
                  <div style={{display:'flex',height:7,borderRadius:4,overflow:'hidden',gap:1}}>
                    {segs.map(({l,v,c})=><div key={l} style={{flex:v/total,background:c}} title={`${l}: ${v}`}/>)}
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:5,flexWrap:'wrap'}}>
                    {segs.map(({l,v,c})=><span key={l} style={{fontSize:9,color:c}}>{v} {l}</span>)}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Quarterly EPS */}
        {loading && <div style={{fontSize:12,color:'#444',padding:'10px 0'}}>Loading financials…</div>}
        {fin?.quarters?.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:'#444',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Quarterly EPS</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
              {fin.quarters.slice(-4).map((q,i) => {
                const beat = q.epsActual!=null && q.epsEstimate!=null ? q.epsActual - q.epsEstimate : null
                return (
                  <div key={i} style={{background:'rgba(255,255,255,0.04)',borderRadius:7,padding:'8px 9px',borderTop:`2px solid ${beat==null?'#333':beat>=0?'#1fb87a':'#e05050'}`}}>
                    <div style={{fontSize:9,color:'#444',marginBottom:3}}>{q.date}</div>
                    <div style={{fontSize:14,fontWeight:700,color:'#f0f0f2'}}>{q.epsActual!=null?'$'+q.epsActual.toFixed(2):'—'}</div>
                    <div style={{fontSize:9,color:'#444',marginTop:2}}>Est: {q.epsEstimate!=null?'$'+q.epsEstimate.toFixed(2):'—'}</div>
                    {beat!=null && <div style={{fontSize:9,color:beat>=0?'#1fb87a':'#e05050',marginTop:2}}>{beat>=0?'+':''}{beat.toFixed(2)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Key metrics */}
        {fin?.financials && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:'#444',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Key Metrics</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
              {[
                {l:'Revenue Growth',   v:fin.financials.revenueGrowth!=null?`${(fin.financials.revenueGrowth*100).toFixed(1)}%`:null},
                {l:'Gross Margin',     v:fin.financials.grossMargins!=null?`${(fin.financials.grossMargins*100).toFixed(1)}%`:null},
                {l:'Operating Margin', v:fin.financials.operatingMargins!=null?`${(fin.financials.operatingMargins*100).toFixed(1)}%`:null},
                {l:'Net Margin',       v:fin.financials.profitMargins!=null?`${(fin.financials.profitMargins*100).toFixed(1)}%`:null},
                {l:'Return on Equity', v:fin.financials.returnOnEquity!=null?`${(fin.financials.returnOnEquity*100).toFixed(1)}%`:null},
                {l:'Debt / Equity',    v:fin.financials.debtToEquity!=null?fin.financials.debtToEquity.toFixed(2):null},
                {l:'Beta',             v:fin.stats?.beta!=null?fin.stats.beta.toFixed(2):null},
                {l:'Current Ratio',    v:fin.financials.currentRatio!=null?fin.financials.currentRatio.toFixed(2):null},
              ].filter(x=>x.v!=null).map(({l,v})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 9px',background:'rgba(255,255,255,0.03)',borderRadius:6}}>
                  <span style={{fontSize:11,color:'#555'}}>{l}</span>
                  <span style={{fontSize:11,fontWeight:600,color:'#f0f0f2'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{fontSize:10,color:'#333',marginTop:8,textAlign:'center'}}>Data via Yahoo Finance · Click outside to close</div>
      </div>
    </div>
  )
}

// ── Multi-select toggle helper ────────────────────────────────────────────────
function toggleSet(set, i) {
  const next = new Set(set)
  next.has(i) ? next.delete(i) : next.add(i)
  return next
}

// ── Main screener ─────────────────────────────────────────────────────────────
export default function StockScreener() {
  const [stocks, setStocks]     = useState([])
  const [loadState, setLoadState] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [detail, setDetail]     = useState(null)

  // Multi-select filter state — each is a Set of selected indices
  const [mcapSel,   setMcapSel]   = useState(new Set())
  const [peSel,     setPeSel]     = useState(new Set())
  const [priceSel,  setPriceSel]  = useState(new Set())
  const [ratingSel, setRatingSel] = useState(new Set())
  const [changePeriod, setChangePeriod] = useState('1D')
  const [changeUp,  setChangeUp]  = useState(null) // null | 'up' | 'down'
  const [sectorSel, setSectorSel] = useState(new Set())
  const [searchQ,   setSearchQ]   = useState('')
  const [sortBy,    setSortBy]    = useState(0)

  const loadData = useCallback(async () => {
    setLoadState('loading'); setProgress(0); setStocks([])
    const syms = SP500_SYMBOLS
    const CHUNK = 30
    const chunks = Array.from({length:Math.ceil(syms.length/CHUNK)},(_,i)=>syms.slice(i*CHUNK,(i+1)*CHUNK))
    const seen = {}
    let done = 0
    for (const chunk of chunks) {
      try {
        const r = await fetch(`/api/screen?symbols=${chunk.join(',')}`)
        if (r.ok) {
          const data = await r.json()
          if (Array.isArray(data)) data.forEach(s => { seen[s.sym] = s })
        } else console.warn('screen error', r.status, await r.text().then(t=>t.slice(0,100)))
      } catch(e) { console.warn('screen fetch error:', e.message) }
      done++
      setProgress(Math.round(done/chunks.length*100))
      setStocks(Object.values(seen))
    }
    setLoadState('done')
  }, [])

  const allSectors = useMemo(() => [...new Set(stocks.map(s=>s.sector).filter(Boolean))].sort(), [stocks])

  // Apply all filters — multi-select means OR within a group, AND between groups
  const filtered = useMemo(() => {
    const q = searchQ.trim().toUpperCase()
    return stocks.filter(s => {
      if (q && !s.sym.includes(q) && !(s.name||'').toUpperCase().includes(q)) return false
      if (mcapSel.size   > 0 && ![...mcapSel].some(i   => MCAP_OPTS[i].test(s)))   return false
      if (peSel.size     > 0 && ![...peSel].some(i     => PE_OPTS[i].test(s)))      return false
      if (priceSel.size  > 0 && ![...priceSel].some(i  => PRICE_OPTS[i].test(s)))   return false
      if (ratingSel.size > 0 && ![...ratingSel].some(i => RATING_OPTS[i].test(s)))  return false
      if (sectorSel.size > 0 && !sectorSel.has(s.sector)) return false
      if (changeUp === 'up'   && (s[`chg${changePeriod}`]??0) <= 0) return false
      if (changeUp === 'down' && (s[`chg${changePeriod}`]??0) >= 0) return false
      return true
    }).sort(SORT_OPTIONS[sortBy].fn)
  }, [stocks, mcapSel, peSel, priceSel, ratingSel, sectorSel, changePeriod, changeUp, sortBy, searchQ])

  const hasFilters = mcapSel.size+peSel.size+priceSel.size+ratingSel.size+sectorSel.size > 0 || changeUp || searchQ
  const reset = () => { setMcapSel(new Set()); setPeSel(new Set()); setPriceSel(new Set()); setRatingSel(new Set()); setSectorSel(new Set()); setChangeUp(null); setSearchQ(''); setSortBy(0) }

  const card = { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'16px' }

  if (loadState === 'idle') return (
    <div style={card}>
      <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:12}}>Stock Screener</div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:'24px 0'}}>
        <div style={{fontSize:13,color:'var(--text-secondary)',textAlign:'center',lineHeight:1.7,maxWidth:440}}>
          Filter ~{SP500_SYMBOLS.length} S&P 500 stocks by market cap, P/E, price, analyst rating, and 1D / 1M / 1Y performance.
          Filters support multi-select — hold multiple ranges at once. Click any row for quarterly EPS and key financials.
        </div>
        <button onClick={loadData} style={{fontSize:13,fontWeight:600,padding:'10px 28px',background:'#4a8fd422',border:'1px solid #4a8fd466',borderRadius:8,color:'#4a8fd4',cursor:'pointer'}}>
          Load Screener Data
        </button>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* Progress bar */}
      {loadState === 'loading' && (
        <div style={card}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:6}}>
            <span>Fetching fundamentals…</span>
            <span>{stocks.length} stocks loaded</span>
          </div>
          <div style={{height:4,background:'var(--bg-secondary)',borderRadius:2}}>
            <div style={{height:4,background:'#4a8fd4',borderRadius:2,width:progress+'%',transition:'width 0.3s'}}/>
          </div>
        </div>
      )}

      {stocks.length > 0 && (
        <div style={card}>
          {/* Search + sort + clear */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search ticker or name…"
              style={{flex:1,minWidth:140,fontSize:12,padding:'7px 11px',background:'var(--bg-secondary)',border:'0.5px solid var(--border-strong)',borderRadius:7,color:'var(--text-primary)',outline:'none'}}
            />
            <select value={sortBy} onChange={e=>setSortBy(Number(e.target.value))} style={{fontSize:11,padding:'7px 10px',background:'var(--bg-secondary)',border:'0.5px solid var(--border-strong)',borderRadius:7,color:'var(--text-secondary)',cursor:'pointer',outline:'none'}}>
              {SORT_OPTIONS.map((o,i)=><option key={i} value={i}>{o.label}</option>)}
            </select>
            {hasFilters && <button onClick={reset} style={{fontSize:11,padding:'7px 12px',background:'rgba(224,80,80,0.1)',border:'0.5px solid rgba(224,80,80,0.3)',borderRadius:7,color:'#e05050',cursor:'pointer'}}>✕ Clear all</button>}
          </div>

          {/* Filters */}
          <FilterGroup label="Market Cap"     opts={MCAP_OPTS}   active={mcapSel}   onToggle={i=>setMcapSel(s=>toggleSet(s,i))}   color="#4a8fd4"/>
          <FilterGroup label="P/E Ratio"      opts={PE_OPTS}     active={peSel}     onToggle={i=>setPeSel(s=>toggleSet(s,i))}     color="#e8a835"/>
          <FilterGroup label="Price"          opts={PRICE_OPTS}  active={priceSel}  onToggle={i=>setPriceSel(s=>toggleSet(s,i))}  color="#9b7de0"/>
          <FilterGroup label="Analyst Rating" opts={RATING_OPTS} active={ratingSel} onToggle={i=>setRatingSel(s=>toggleSet(s,i))} color="#1fb87a"/>

          {/* Performance with period toggle */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:8}}>
              Performance
              <div style={{display:'flex',gap:2}}>
                {CHANGE_PERIODS.map(p=>(
                  <button key={p} onClick={()=>setChangePeriod(p)} style={{fontSize:9,padding:'2px 7px',borderRadius:4,background:changePeriod===p?'rgba(255,255,255,0.12)':'transparent',border:changePeriod===p?'1px solid rgba(255,255,255,0.2)':'1px solid transparent',color:changePeriod===p?'var(--text-primary)':'var(--text-muted)',cursor:'pointer'}}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:4}}>
              {[['All',null],['↑ Up','up'],['↓ Down','down']].map(([l,v])=>(
                <Pill key={l} label={l} active={changeUp===v} onClick={()=>setChangeUp(changeUp===v?null:v)} color="#4ab8b8"/>
              ))}
            </div>
          </div>

          {/* Sector multi-select */}
          {allSectors.length > 0 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:6}}>
                Sector
                {sectorSel.size>0 && <span style={{fontSize:9,background:'#4ab8b833',color:'#4ab8b8',border:'1px solid #4ab8b866',borderRadius:8,padding:'1px 6px'}}>{sectorSel.size} selected</span>}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {allSectors.map(s=>(
                  <Pill key={s} label={s} active={sectorSel.has(s)} onClick={()=>setSectorSel(prev=>{const n=new Set(prev);n.has(s)?n.delete(s):n.add(s);return n})} color="#4ab8b8"/>
                ))}
              </div>
            </div>
          )}

          {/* Result count */}
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,display:'flex',justifyContent:'space-between'}}>
            <span>{filtered.length} of {stocks.length} stocks{loadState==='loading'?' (loading…)':''}</span>
            <span style={{fontSize:10,opacity:0.6}}>click any row for detail</span>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{fontSize:12,color:'var(--text-muted)',padding:'24px 0',textAlign:'center'}}>
              No stocks match — try removing some filters or selecting multiple ranges within a group
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:'0.5px solid var(--border)'}}>
                    {['Ticker','Name','Price','1D%','1M%','1Y%','Mkt Cap','P/E','Fwd P/E','Rating','Sector'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:600,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,150).map(s => (
                    <tr key={s.sym} onClick={()=>setDetail(s)}
                      style={{borderBottom:'0.5px solid var(--border)',cursor:'pointer',transition:'background 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-secondary)'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}
                    >
                      <td style={{padding:'6px 8px',fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap'}}>{s.sym}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-primary)',whiteSpace:'nowrap'}}>{fmtPrice(s.price)}</td>
                      <td style={{padding:'6px 8px',color:pctColor(s.chg1D),whiteSpace:'nowrap'}}>{fmtPct(s.chg1D)}</td>
                      <td style={{padding:'6px 8px',color:pctColor(s.chg1M),whiteSpace:'nowrap'}}>{fmtPct(s.chg1M)}</td>
                      <td style={{padding:'6px 8px',color:pctColor(s.chg1Y),whiteSpace:'nowrap'}}>{fmtPct(s.chg1Y)}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{fmtMcap(s.marketCap)}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{fmtPE(s.trailingPE)}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{fmtPE(s.forwardPE)}</td>
                      <td style={{padding:'6px 8px',whiteSpace:'nowrap'}}>
                        {s.analystRating
                          ? <span style={{fontSize:10,fontWeight:600,color:rColor(s.analystRating)}}>{rLabel(s.analystRating)}</span>
                          : <span style={{color:'var(--text-muted)'}}>—</span>}
                      </td>
                      <td style={{padding:'6px 8px',color:'var(--text-muted)',whiteSpace:'nowrap',fontSize:10}}>{s.sector??'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 150 && (
                <div style={{fontSize:11,color:'var(--text-muted)',padding:'10px 8px'}}>Showing 150 of {filtered.length} — refine filters to narrow down</div>
              )}
            </div>
          )}
        </div>
      )}

      {detail && <StockDetail stock={detail} onClose={()=>setDetail(null)}/>}
    </div>
  )
}
