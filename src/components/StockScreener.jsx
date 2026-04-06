import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { SP500_SYMBOLS } from '../sp500symbols'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtMcap = v => { if(!v)return'—'; if(v>=1e12)return'$'+(v/1e12).toFixed(2)+'T'; if(v>=1e9)return'$'+(v/1e9).toFixed(1)+'B'; return'$'+(v/1e6).toFixed(0)+'M' }
const fmtNum  = (v,d=1) => v!=null ? v.toFixed(d) : '—'
const fmtPct  = v => v!=null ? (v>=0?'+':'')+v.toFixed(2)+'%' : '—'
const fmtPrice= v => v!=null ? '$'+v.toFixed(2) : '—'
const fmtPE   = v => v!=null && isFinite(v) ? v.toFixed(1) : '—'
const pctColor= v => v==null?'var(--text-muted)':v>=0?'#1fb87a':'#e05050'
const ratingColor = r => ({ strong_buy:'#1fb87a', buy:'#7ab87a', hold:'#e8a835', sell:'#e07840', strong_sell:'#e05050' }[r] ?? 'var(--text-muted)')
const ratingLabel = r => ({ strong_buy:'Strong Buy', buy:'Buy', hold:'Hold', sell:'Sell', strong_sell:'Strong Sell' }[r] ?? r ?? '—')

// ── Filter constants ──────────────────────────────────────────────────────────
const MCAP_TIERS = [
  {label:'All caps'},
  {label:'> $1T',        test:s=>s.marketCap>=1e12},
  {label:'$500B–$1T',   test:s=>s.marketCap>=500e9&&s.marketCap<1e12},
  {label:'$100B–$500B', test:s=>s.marketCap>=100e9&&s.marketCap<500e9},
  {label:'$10B–$100B',  test:s=>s.marketCap>=10e9&&s.marketCap<100e9},
  {label:'< $10B',       test:s=>s.marketCap<10e9},
]
const PE_RANGES = [
  {label:'All P/E'},
  {label:'< 15',     test:s=>s.trailingPE!=null&&s.trailingPE<15&&s.trailingPE>0},
  {label:'15–25',    test:s=>s.trailingPE!=null&&s.trailingPE>=15&&s.trailingPE<=25},
  {label:'25–50',    test:s=>s.trailingPE!=null&&s.trailingPE>25&&s.trailingPE<=50},
  {label:'50–100',   test:s=>s.trailingPE!=null&&s.trailingPE>50&&s.trailingPE<=100},
  {label:'> 100',    test:s=>s.trailingPE!=null&&s.trailingPE>100},
  {label:'Negative', test:s=>s.trailingPE!=null&&s.trailingPE<0},
  {label:'No P/E',   test:s=>s.trailingPE==null},
]
const PRICE_RANGES = [
  {label:'All prices'},
  {label:'< $50',       test:s=>s.price<50},
  {label:'$50–$150',    test:s=>s.price>=50&&s.price<150},
  {label:'$150–$300',   test:s=>s.price>=150&&s.price<300},
  {label:'$300–$500',   test:s=>s.price>=300&&s.price<500},
  {label:'> $500',      test:s=>s.price>=500},
]
const CHANGE_PERIODS = ['1D','1M','1Y']
const CHANGE_FILTERS = [
  {label:'All'},
  {label:'↑ Up',        test:(s,p)=>(s[`chg${p}`]??0)>0},
  {label:'↓ Down',      test:(s,p)=>(s[`chg${p}`]??0)<0},
  {label:'↑↑ +5%+',    test:(s,p)=>(s[`chg${p}`]??0)>=5},
  {label:'↓↓ -5%+',    test:(s,p)=>(s[`chg${p}`]??0)<=-5},
]
const ANALYST_FILTERS = [
  {label:'Any rating'},
  {label:'Strong Buy', test:s=>s.analystRating==='strong_buy'},
  {label:'Buy',        test:s=>s.analystRating==='buy'||s.analystRating==='strong_buy'},
  {label:'Hold',       test:s=>s.analystRating==='hold'},
  {label:'Sell / Strong Sell', test:s=>s.analystRating==='sell'||s.analystRating==='strong_sell'},
]
const SORT_OPTIONS = [
  {label:'Mkt Cap ↓',  fn:(a,b)=>(b.marketCap??0)-(a.marketCap??0)},
  {label:'Mkt Cap ↑',  fn:(a,b)=>(a.marketCap??0)-(b.marketCap??0)},
  {label:'Price ↓',    fn:(a,b)=>(b.price??0)-(a.price??0)},
  {label:'Price ↑',    fn:(a,b)=>(a.price??0)-(b.price??0)},
  {label:'P/E ↓',      fn:(a,b)=>(b.trailingPE??Infinity)-(a.trailingPE??Infinity)},
  {label:'P/E ↑',      fn:(a,b)=>(a.trailingPE??-Infinity)-(b.trailingPE??-Infinity)},
  {label:'1D chg ↓',   fn:(a,b)=>(b.chg1D??-99)-(a.chg1D??-99)},
  {label:'1D chg ↑',   fn:(a,b)=>(a.chg1D??99)-(b.chg1D??99)},
  {label:'1M chg ↓',   fn:(a,b)=>(b.chg1M??-99)-(a.chg1M??-99)},
  {label:'1Y chg ↓',   fn:(a,b)=>(b.chg1Y??-99)-(a.chg1Y??-99)},
  {label:'A–Z',        fn:(a,b)=>a.sym.localeCompare(b.sym)},
]

// ── Pill button ───────────────────────────────────────────────────────────────
function Pill({label, active, onClick, color='#4a8fd4'}) {
  return (
    <button onClick={onClick} style={{
      fontSize:11, padding:'4px 11px', borderRadius:20, cursor:'pointer',
      fontWeight:active?600:400,
      background:active?color+'22':'var(--bg-secondary)',
      border:active?`1px solid ${color}66`:'0.5px solid var(--border)',
      color:active?color:'var(--text-secondary)',
      transition:'all 0.12s', whiteSpace:'nowrap',
    }}>{label}</button>
  )
}

// ── Stock detail drawer ───────────────────────────────────────────────────────
function StockDetail({ stock, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setData(null)
    fetch(`/api/financials?symbol=${stock.sym}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [stock.sym])

  const up = (stock.chg1D ?? 0) >= 0

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'flex-start', justifyContent:'flex-end',
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'min(520px, 100vw)', height:'100vh', overflowY:'auto',
        background:'#16161a', borderLeft:'0.5px solid rgba(255,255,255,0.12)',
        padding:'24px 20px',
      }}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:'#f0f0f2'}}>{stock.sym}</div>
            <div style={{fontSize:12,color:'#666',marginTop:2}}>{stock.name}</div>
            <div style={{fontSize:11,color:'#555',marginTop:1}}>{stock.sector}{stock.industry?` · ${stock.industry}`:''}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:8,width:30,height:30,color:'#aaa',fontSize:16,cursor:'pointer'}}>✕</button>
        </div>

        {/* Price snapshot */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
          {[
            {l:'Price',       v:fmtPrice(stock.price),    c:'#f0f0f2'},
            {l:'Today',       v:fmtPct(stock.chg1D),      c:pctColor(stock.chg1D)},
            {l:'1 Month',     v:fmtPct(stock.chg1M),      c:pctColor(stock.chg1M)},
            {l:'1 Year',      v:fmtPct(stock.chg1Y),      c:pctColor(stock.chg1Y)},
            {l:'Mkt Cap',     v:fmtMcap(stock.marketCap), c:'#f0f0f2'},
            {l:'P/E (ttm)',   v:fmtPE(stock.trailingPE),  c:'#f0f0f2'},
            {l:'Fwd P/E',     v:fmtPE(stock.forwardPE),   c:'#f0f0f2'},
            {l:'EPS (ttm)',   v:stock.eps!=null?'$'+stock.eps.toFixed(2):'—', c:'#f0f0f2'},
            {l:'52w Range',   v:(stock.week52Low&&stock.week52High)?`$${stock.week52Low?.toFixed(0)}–$${stock.week52High?.toFixed(0)}`:'—', c:'#f0f0f2'},
          ].map(({l,v,c})=>(
            <div key={l} style={{background:'rgba(255,255,255,0.04)',borderRadius:7,padding:'8px 10px'}}>
              <div style={{fontSize:9,color:'#555',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.05em'}}>{l}</div>
              <div style={{fontSize:13,fontWeight:600,color:c}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Analyst rating */}
        {stock.analystRating && (
          <div style={{marginBottom:16,padding:'12px 14px',background:'rgba(255,255,255,0.04)',borderRadius:8,border:`0.5px solid ${ratingColor(stock.analystRating)}44`}}>
            <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Analyst Consensus</div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:18,fontWeight:700,color:ratingColor(stock.analystRating)}}>{ratingLabel(stock.analystRating)}</div>
              {stock.analystCount && <div style={{fontSize:11,color:'#555'}}>{stock.analystCount} analysts</div>}
              {stock.targetPrice && <div style={{fontSize:12,color:'#f0f0f2'}}>Target: {fmtPrice(stock.targetPrice)}</div>}
            </div>
            {/* Analyst breakdown bar from financials */}
            {data?.financials && (()=>{
              const f = data.financials
              const total = (f.strongBuy??0)+(f.buy??0)+(f.hold??0)+(f.sell??0)+(f.strongSell??0)
              if(!total) return null
              const pcts = [
                {l:'Strong Buy', v:f.strongBuy??0, c:'#1fb87a'},
                {l:'Buy',        v:f.buy??0,       c:'#7ab87a'},
                {l:'Hold',       v:f.hold??0,      c:'#e8a835'},
                {l:'Sell',       v:f.sell??0,      c:'#e07840'},
                {l:'Strong Sell',v:f.strongSell??0,c:'#e05050'},
              ].filter(x=>x.v>0)
              return (
                <div style={{marginTop:10}}>
                  <div style={{display:'flex',height:8,borderRadius:4,overflow:'hidden',gap:1}}>
                    {pcts.map(({l,v,c})=>(
                      <div key={l} style={{flex:v/total,background:c}} title={`${l}: ${v}`}/>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:10,marginTop:5,flexWrap:'wrap'}}>
                    {pcts.map(({l,v,c})=>(
                      <span key={l} style={{fontSize:9,color:c}}>{v} {l}</span>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Quarterly EPS */}
        {loading && <div style={{fontSize:12,color:'#555',padding:'12px 0'}}>Loading financials…</div>}
        {data?.quarters?.length>0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Quarterly EPS</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
              {data.quarters.slice(-4).map((q,i)=>{
                const beat = q.epsActual!=null && q.epsEstimate!=null ? q.epsActual-q.epsEstimate : null
                return (
                  <div key={i} style={{background:'rgba(255,255,255,0.04)',borderRadius:7,padding:'8px 10px',borderTop:`2px solid ${beat==null?'#444':beat>=0?'#1fb87a':'#e05050'}`}}>
                    <div style={{fontSize:9,color:'#555',marginBottom:4}}>{q.date}</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#f0f0f2'}}>{q.epsActual!=null?'$'+q.epsActual.toFixed(2):'—'}</div>
                    <div style={{fontSize:9,color:'#555',marginTop:2}}>Est: {q.epsEstimate!=null?'$'+q.epsEstimate.toFixed(2):'—'}</div>
                    {beat!=null&&<div style={{fontSize:9,color:beat>=0?'#1fb87a':'#e05050',marginTop:2}}>{beat>=0?'+':''}{beat.toFixed(2)} {q.surprisePct!=null?`(${q.surprisePct.toFixed(1)}%)`:''}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Key financials */}
        {data?.financials && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Key Metrics</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {l:'Revenue Growth',    v:data.financials.revenueGrowth!=null?(data.financials.revenueGrowth*100).toFixed(1)+'%':null},
                {l:'Gross Margin',      v:data.financials.grossMargins!=null?(data.financials.grossMargins*100).toFixed(1)+'%':null},
                {l:'Operating Margin',  v:data.financials.operatingMargins!=null?(data.financials.operatingMargins*100).toFixed(1)+'%':null},
                {l:'Net Margin',        v:data.financials.profitMargins!=null?(data.financials.profitMargins*100).toFixed(1)+'%':null},
                {l:'Return on Equity',  v:data.financials.returnOnEquity!=null?(data.financials.returnOnEquity*100).toFixed(1)+'%':null},
                {l:'Debt/Equity',       v:data.financials.debtToEquity!=null?data.financials.debtToEquity.toFixed(2):null},
                {l:'Current Ratio',     v:data.financials.currentRatio!=null?data.financials.currentRatio.toFixed(2):null},
                {l:'Beta',              v:data.stats?.beta!=null?data.stats.beta.toFixed(2):null},
              ].filter(x=>x.v!=null).map(({l,v})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'rgba(255,255,255,0.03)',borderRadius:6}}>
                  <span style={{fontSize:11,color:'#666'}}>{l}</span>
                  <span style={{fontSize:11,fontWeight:600,color:'#f0f0f2'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{fontSize:10,color:'#333',marginTop:8}}>Data via Yahoo Finance · Click outside to close</div>
      </div>
    </div>
  )
}

// ── Main screener ─────────────────────────────────────────────────────────────
export default function StockScreener() {
  const [stocks, setStocks]     = useState([])
  const [state, setState]       = useState('idle')
  const [progress, setProgress] = useState(0)
  const [detail, setDetail]     = useState(null)

  // Filter state
  const [searchQ,   setSearchQ]   = useState('')
  const [mcap,      setMcap]      = useState(0)
  const [pe,        setPe]        = useState(0)
  const [price,     setPrice]     = useState(0)
  const [changePeriod, setChangePeriod] = useState('1D')
  const [changeF,   setChangeF]   = useState(0)
  const [analyst,   setAnalyst]   = useState(0)
  const [sector,    setSector]    = useState('All')
  const [sortBy,    setSortBy]    = useState(0)

  const loadData = useCallback(async () => {
    setState('loading'); setProgress(0); setStocks([])
    const syms = SP500_SYMBOLS
    const CHUNK = 25, PARALLEL = 4
    const chunks = []
    for(let i=0;i<syms.length;i+=CHUNK) chunks.push(syms.slice(i,i+CHUNK))

    // Fetch all chunks, update state as each arrives
    let done = 0
    const allMap = {}

    const processChunk = async (chunk) => {
      try {
        // Primary: screener endpoint (has PE, sector, analyst)
        const r = await fetch(`/api/screen?symbols=${chunk.join(',')}`)
        if(r.ok) {
          const data = await r.json()
          if(Array.isArray(data)) data.forEach(s => { allMap[s.sym] = s })
        }
        // Also fetch 1M and 1Y closes for period change
        const hist = await fetch(`/api/quote?symbols=${chunk.join(',')}&range=1y&interval=1d`)
        if(hist.ok) {
          const hdata = await hist.json()
          hdata.forEach(entry => {
            if(!entry?.data) return
            const closes = entry.data?.indicators?.quote?.[0]?.close?.filter(v=>v!=null) ?? []
            const n = closes.length
            const price = entry.data?.meta?.regularMarketPrice
            if(allMap[entry.sym]) {
              allMap[entry.sym].chg1Y = n>1 ? (price-closes[0])/closes[0]*100 : null
              allMap[entry.sym].chg1M = n>21 ? (price-closes[n-22])/closes[n-22]*100 : null
              // 1D already from screen endpoint as changePercent
              allMap[entry.sym].chg1D = allMap[entry.sym].changePercent
            }
          })
        }
      } catch(e) { console.warn('chunk error:', e.message) }
      done++
      setProgress(Math.min(99, Math.round(done/chunks.length*100)))
      setStocks(Object.values(allMap))
    }

    // Process in parallel batches
    for(let i=0;i<chunks.length;i+=PARALLEL) {
      await Promise.all(chunks.slice(i,i+PARALLEL).map(processChunk))
    }
    setState('done'); setProgress(100)
    setStocks(Object.values(allMap))
  }, [])

  const sectors = useMemo(() => {
    const s = new Set(stocks.map(st=>st.sector).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [stocks])

  const filtered = useMemo(() => {
    const q = searchQ.trim().toUpperCase()
    return stocks.filter(s => {
      if(q && !s.sym.includes(q) && !(s.name||'').toUpperCase().includes(q)) return false
      if(mcap>0 && !MCAP_TIERS[mcap].test(s)) return false
      if(pe>0 && !PE_RANGES[pe].test(s)) return false
      if(price>0 && !PRICE_RANGES[price].test(s)) return false
      if(changeF>0 && !CHANGE_FILTERS[changeF].test(s, changePeriod)) return false
      if(analyst>0 && !ANALYST_FILTERS[analyst].test(s)) return false
      if(sector!=='All' && s.sector!==sector) return false
      return true
    }).sort(SORT_OPTIONS[sortBy].fn)
  }, [stocks, mcap, pe, price, changeF, changePeriod, analyst, sector, sortBy, searchQ])

  const activeCount = [mcap,pe,price,changeF,analyst].filter(v=>v!==0).length + (sector!=='All'?1:0) + (searchQ?1:0)
  const reset = () => { setSearchQ(''); setMcap(0); setPe(0); setPrice(0); setChangeF(0); setAnalyst(0); setSector('All'); setSortBy(0) }

  const card = {background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:'var(--radius)',padding:'16px'}

  if(state==='idle') return (
    <div style={card}>
      <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:12}}>Stock Screener</div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:'24px 0'}}>
        <div style={{fontSize:13,color:'var(--text-secondary)',textAlign:'center',lineHeight:1.7,maxWidth:440}}>
          Filter ~{SP500_SYMBOLS.length} S&P 500 stocks by market cap, P/E, price, analyst rating, and performance over 1D / 1M / 1Y.
          Click any row for quarterly EPS history, margins, and analyst breakdown.
        </div>
        <button onClick={loadData} style={{fontSize:13,fontWeight:600,padding:'10px 28px',background:'#4a8fd422',border:'1px solid #4a8fd466',borderRadius:8,color:'#4a8fd4',cursor:'pointer'}}>
          Load Screener Data
        </button>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* Progress */}
      {state==='loading' && (
        <div style={card}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:6}}>
            <span>Fetching fundamentals…</span><span>{stocks.length} stocks loaded</span>
          </div>
          <div style={{height:4,background:'var(--bg-secondary)',borderRadius:2}}>
            <div style={{height:4,background:'#4a8fd4',borderRadius:2,width:progress+'%',transition:'width 0.3s'}}/>
          </div>
        </div>
      )}

      {/* Filters + table */}
      {stocks.length>0 && (
        <div style={card}>
          {/* Search + sort + clear */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              placeholder="Search ticker or name…"
              style={{flex:1,minWidth:140,fontSize:12,padding:'7px 11px',background:'var(--bg-secondary)',border:'0.5px solid var(--border-strong)',borderRadius:7,color:'var(--text-primary)',outline:'none'}}
            />
            <select value={sortBy} onChange={e=>setSortBy(Number(e.target.value))} style={{fontSize:11,padding:'7px 10px',background:'var(--bg-secondary)',border:'0.5px solid var(--border-strong)',borderRadius:7,color:'var(--text-secondary)',cursor:'pointer',outline:'none'}}>
              {SORT_OPTIONS.map((o,i)=><option key={i} value={i}>{o.label}</option>)}
            </select>
            {activeCount>0 && <button onClick={reset} style={{fontSize:11,padding:'7px 12px',background:'rgba(224,80,80,0.1)',border:'0.5px solid rgba(224,80,80,0.3)',borderRadius:7,color:'#e05050',cursor:'pointer'}}>✕ Clear {activeCount}</button>}
          </div>

          {/* Filter rows */}
          {[
            {l:'Market Cap',   items:MCAP_TIERS, active:mcap,    set:setMcap,    color:'#4a8fd4'},
            {l:'P/E Ratio',    items:PE_RANGES,  active:pe,      set:setPe,      color:'#e8a835'},
            {l:'Price',        items:PRICE_RANGES,active:price,  set:setPrice,   color:'#9b7de0'},
            {l:'Analyst Rating',items:ANALYST_FILTERS,active:analyst,set:setAnalyst,color:'#1fb87a'},
          ].map(({l,items,active,set,color})=>(
            <div key={l} style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{l}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {items.map((t,i)=><Pill key={t.label} label={t.label} active={active===i} onClick={()=>set(i)} color={color}/>)}
              </div>
            </div>
          ))}

          {/* Performance filter with period toggle */}
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:8}}>
              Performance
              <div style={{display:'flex',gap:2}}>
                {CHANGE_PERIODS.map(p=>(
                  <button key={p} onClick={()=>setChangePeriod(p)} style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:changePeriod===p?'rgba(255,255,255,0.12)':'transparent',border:changePeriod===p?'1px solid rgba(255,255,255,0.2)':'1px solid transparent',color:changePeriod===p?'var(--text-primary)':'var(--text-muted)',cursor:'pointer'}}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {CHANGE_FILTERS.map((t,i)=><Pill key={t.label} label={t.label} active={changeF===i} onClick={()=>setChangeF(i)} color='#4ab8b8'/>)}
            </div>
          </div>

          {/* Sector */}
          {sectors.length>1 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Sector</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {sectors.map(s=><Pill key={s} label={s} active={sector===s} onClick={()=>setSector(s)} color='#4ab8b8'/>)}
              </div>
            </div>
          )}

          {/* Status */}
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>
            {filtered.length} of {stocks.length} stocks · click any row for detail
          </div>

          {/* Results table */}
          {filtered.length===0 ? (
            <div style={{fontSize:12,color:'var(--text-muted)',padding:'20px 0',textAlign:'center'}}>No stocks match these filters.</div>
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
                  {filtered.slice(0,150).map((s,i)=>(
                    <tr key={s.sym} onClick={()=>setDetail(s)}
                      style={{borderBottom:'0.5px solid var(--border)',cursor:'pointer',transition:'background 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-secondary)'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}
                    >
                      <td style={{padding:'6px 8px',fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap'}}>{s.sym}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-primary)',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmtPrice(s.price)}</td>
                      <td style={{padding:'6px 8px',color:pctColor(s.chg1D),whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmtPct(s.chg1D)}</td>
                      <td style={{padding:'6px 8px',color:pctColor(s.chg1M),whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmtPct(s.chg1M)}</td>
                      <td style={{padding:'6px 8px',color:pctColor(s.chg1Y),whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmtPct(s.chg1Y)}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{fmtMcap(s.marketCap)}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmtPE(s.trailingPE)}</td>
                      <td style={{padding:'6px 8px',color:'var(--text-secondary)',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmtPE(s.forwardPE)}</td>
                      <td style={{padding:'6px 8px',whiteSpace:'nowrap'}}>
                        <span style={{fontSize:10,fontWeight:600,color:ratingColor(s.analystRating)}}>{ratingLabel(s.analystRating)}</span>
                      </td>
                      <td style={{padding:'6px 8px',color:'var(--text-muted)',whiteSpace:'nowrap',fontSize:10}}>{s.sector??'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length>150 && <div style={{fontSize:11,color:'var(--text-muted)',padding:'10px 8px'}}>Showing 150 of {filtered.length} — refine filters</div>}
            </div>
          )}
        </div>
      )}

      {detail && <StockDetail stock={detail} onClose={()=>setDetail(null)}/>}
    </div>
  )
}
