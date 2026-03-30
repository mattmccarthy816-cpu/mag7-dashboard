import React, { useState, useRef, useEffect } from 'react'
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { extractCloses, extractTimestamps, pctChange } from '../api'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip)

function hexToRgba(hex, op) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${op})`
}

async function fetchTicker(sym) {
  const res = await fetch(`/api/quote?symbols=${sym}&range=1y&interval=1d`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const result = data?.[0]?.data
  if (!result) throw new Error(`No data for "${sym}"`)
  return result
}

const CHART_COLORS = ['#4a8fd4','#1fb87a','#e8a835','#9b7de0','#d4507a','#4ab8b8','#e05050']

function MiniCompareChart({ stockResult, spyResult, sym, color }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const hoveredRef = useRef(null)

  const stockCloses = extractCloses(stockResult)
  const spyCloses = extractCloses(spyResult)
  const ts = extractTimestamps(spyResult)
  const n = Math.min(stockCloses.length, spyCloses.length, ts.length)

  const stockYr = n > 1 ? pctChange(stockCloses[n-1], stockCloses[0]) : null
  const spyYr = n > 1 ? pctChange(spyCloses[n-1], spyCloses[0]) : null
  const diff = stockYr != null && spyYr != null ? stockYr - spyYr : null

  useEffect(() => {
    if (!canvasRef.current || n < 2) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = ts.slice(0,n).map(t => new Date(t*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'}))
    const sBase = stockCloses[0], mBase = spyCloses[0]

    const configs = [
      { label: sym,   data: stockCloses.slice(0,n).map(v => v&&sBase ? +((v-sBase)/sBase*100).toFixed(2) : null), color, dash:[] },
      { label: 'SPY', data: spyCloses.slice(0,n).map(v => v&&mBase ? +((v-mBase)/mBase*100).toFixed(2) : null), color:'#e0e0f0', dash:[5,3] },
    ]

    const datasets = configs.map(c => ({
      label: c.label, data: c.data,
      borderColor: hexToRgba(c.color, c.label==='SPY'?0.65:1),
      borderWidth: c.label==='SPY'?1.5:2,
      borderDash: c.dash,
      pointRadius:0, fill:false, tension:0.3, spanGaps:true,
      _color: c.color, _isSPY: c.label==='SPY',
    }))

    chartRef.current = new Chart(canvasRef.current, {
      type:'line', data:{labels,datasets},
      options:{
        responsive:true, maintainAspectRatio:false, animation:false,
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.parsed.y==null?null:` ${ctx.dataset.label}: ${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toFixed(2)}%`}}},
        scales:{
          x:{grid:{display:false},ticks:{color:'#555',font:{size:10},maxTicksLimit:8,maxRotation:0}},
          y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#555',font:{size:10},callback:v=>(v>=0?'+':'')+v.toFixed(0)+'%'}},
        },
        onHover:(_evt,els)=>{
          if(!chartRef.current)return
          const evt=_evt.native
          if(!els.length||!evt){if(hoveredRef.current!==null){hoveredRef.current=null;restore()}}
          else{
            const rect=canvasRef.current.getBoundingClientRect()
            const my=evt.clientY-rect.top
            let cl=null,md=Infinity
            els.forEach(el=>{const d=Math.abs(el.element.y-my);if(d<md){md=d;cl=el.datasetIndex}})
            if(hoveredRef.current!==cl){hoveredRef.current=cl;highlight(cl)}
          }
        },
      },
    })

    const highlight=(idx)=>{
      if(!chartRef.current)return
      chartRef.current.data.datasets.forEach((ds,i)=>{
        if(idx===null){ds.borderColor=hexToRgba(ds._color,ds._isSPY?0.65:1);ds.borderWidth=ds._isSPY?1.5:2}
        else if(i===idx){ds.borderColor=hexToRgba(ds._color,1);ds.borderWidth=2.5}
        else{ds.borderColor=hexToRgba(ds._color,0.12);ds.borderWidth=0.8}
      })
      chartRef.current.update('none')
    }
    const restore=()=>highlight(null)

    const canvas=canvasRef.current
    canvas.addEventListener('mouseleave',restore)
    return()=>{canvas.removeEventListener('mouseleave',restore);if(chartRef.current)chartRef.current.destroy()}
  },[stockResult,spyResult,sym,color])

  const price = stockResult?.meta?.regularMarketPrice
  const prev = stockResult?.meta?.chartPreviousClose||stockResult?.meta?.previousClose
  const dayChg = pctChange(price,prev)

  return (
    <div>
      <div style={{display:'flex',gap:20,marginBottom:10,flexWrap:'wrap'}}>
        {[
          {label:'Price', val: price?`$${price.toFixed(2)}`:'—', color:'#f0f0f2'},
          {label:'Today', val: dayChg!=null?(dayChg>=0?'+':'')+dayChg.toFixed(2)+'%':'—', color:dayChg>=0?'#1fb87a':'#e05050'},
          {label:'1yr', val: stockYr!=null?(stockYr>=0?'+':'')+stockYr.toFixed(1)+'%':'—', color:stockYr>=0?'#1fb87a':'#e05050'},
          {label:'vs S&P 500', val: diff!=null?(diff>=0?'+':'')+diff.toFixed(1)+'%':'—', color:diff>=0?'#1fb87a':'#e05050'},
        ].map(s=>(
          <div key={s.label}>
            <div style={{fontSize:10,color:'var(--text-muted)'}}>{s.label}</div>
            <div style={{fontSize:15,fontWeight:600,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:14,marginBottom:8}}>
        {[{l:sym,c:color,d:false},{l:'SPY',c:'#e0e0f0',d:true}].map(x=>(
          <span key={x.l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#e8e8f0'}}>
            <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={x.c} strokeWidth="2" strokeDasharray={x.d?'5,3':undefined}/></svg>
            {x.l}
          </span>
        ))}
      </div>
      <div style={{position:'relative',width:'100%',height:180}}><canvas ref={canvasRef}/></div>
    </div>
  )
}

export default function TickerSearch({ spyResult, onAddFavorite, favorites }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)

  // Focus input when modal opens
  useEffect(()=>{
    if(open) setTimeout(()=>inputRef.current?.focus(),50)
  },[open])

  // Close on Escape
  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')setOpen(false)}
    window.addEventListener('keydown',h)
    return()=>window.removeEventListener('keydown',h)
  },[])

  const handleSearch = async (raw) => {
    const sym = raw.trim().toUpperCase()
    if(!sym) return
    const color = CHART_COLORS[results.length % CHART_COLORS.length]
    // Replace any existing result (one at a time)
    setResults([{sym,result:null,color:CHART_COLORS[0],loading:true,error:null}])
    setInput('')
    try {
      const result = await fetchTicker(sym)
      setResults(prev=>prev.map(r=>r.sym===sym?{...r,result,loading:false}:r))
    } catch(err) {
      setResults(prev=>prev.map(r=>r.sym===sym?{...r,loading:false,error:err.message}:r))
    }
  }

  const isFav = (sym) => favorites?.includes(sym)

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={()=>setOpen(true)}
        style={{
          display:'flex', alignItems:'center', gap:8,
          fontSize:13, fontWeight:500,
          padding:'8px 18px',
          background:'var(--bg-card)',
          border:'0.5px solid var(--border-strong)',
          borderRadius:20,
          color:'var(--text-secondary)',
          cursor:'pointer',
          transition:'border-color 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.25)'}
        onMouseLeave={e=>e.currentTarget.style.borderColor=''}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="6" cy="6" r="4.5"/><line x1="9.5" y1="9.5" x2="13" y2="13"/>
        </svg>
        Search any ticker
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={()=>setOpen(false)}
          style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:80,padding:'80px 24px 24px'}}
        >
          <div
            onClick={e=>e.stopPropagation()}
            style={{background:'#16161a',border:'0.5px solid rgba(255,255,255,0.14)',borderRadius:14,width:'100%',maxWidth:720,maxHeight:'80vh',display:'flex',flexDirection:'column'}}
          >
            {/* Search bar */}
            <div style={{display:'flex',gap:8,padding:'16px 20px',borderBottom:'0.5px solid rgba(255,255,255,0.08)'}}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.8" style={{flexShrink:0,marginTop:10}}>
                <circle cx="6" cy="6" r="4.5"/><line x1="9.5" y1="9.5" x2="13" y2="13"/>
              </svg>
              <input
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==='Enter'&&handleSearch(input)}
                placeholder="Enter ticker symbol, e.g. AAPL, TSLA, BRK-B…"
                style={{flex:1,fontSize:15,background:'none',border:'none',color:'#f0f0f2',outline:'none',padding:'8px 0'}}
              />
              {input && (
                <button onClick={()=>handleSearch(input)} style={{fontSize:12,fontWeight:600,padding:'6px 14px',background:'rgba(255,255,255,0.08)',border:'0.5px solid rgba(255,255,255,0.15)',borderRadius:8,color:'#ccc',cursor:'pointer',flexShrink:0}}>
                  Search ↵
                </button>
              )}
              <button onClick={()=>setOpen(false)} style={{fontSize:13,background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,width:30,height:30,color:'#888',cursor:'pointer',flexShrink:0,alignSelf:'center'}}>✕</button>
            </div>

            {/* Results */}
            <div style={{overflowY:'auto',flex:1,padding:'0 20px'}}>
              {results.length===0 && (
                <div style={{padding:'32px 0',textAlign:'center',color:'var(--text-muted)',fontSize:13,lineHeight:1.7}}>
                  Search any US stock ticker to compare its 1-year<br/>performance vs the S&P 500.
                  <br/>Type a symbol and press Enter.
                </div>
              )}

              {results.map((s,idx)=>(
                <div key={s.sym} style={{borderBottom:'0.5px solid rgba(255,255,255,0.07)',padding:'16px 0'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:10,height:10,borderRadius:3,background:s.color,display:'inline-block'}}/>
                      <span style={{fontSize:16,fontWeight:700,color:'#f0f0f2'}}>{s.sym}</span>
                      {s.result?.meta?.longName && (
                        <span style={{fontSize:11,color:'#555'}}>{s.result.meta.longName}</span>
                      )}
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      {s.result && !isFav(s.sym) && onAddFavorite && (
                        <button
                          onClick={()=>onAddFavorite(s.sym)}
                          style={{fontSize:11,fontWeight:600,padding:'4px 12px',background:'rgba(224,80,80,0.1)',border:'0.5px solid rgba(224,80,80,0.3)',borderRadius:6,color:'#e05050',cursor:'pointer'}}
                        >
                          ♡ Add to favorites
                        </button>
                      )}
                      {s.result && isFav(s.sym) && (
                        <span style={{fontSize:11,color:'#e05050',padding:'4px 8px'}}>♥ In favorites</span>
                      )}
                      <button onClick={()=>setResults(prev=>prev.filter(r=>r.sym!==s.sym))} style={{fontSize:12,background:'none',border:'none',color:'#555',cursor:'pointer',padding:'4px 6px'}}>✕</button>
                    </div>
                  </div>

                  {s.loading && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[100,80,60].map((w,i)=>(
                        <div key={i} style={{height:10,borderRadius:4,width:w+'%',background:'rgba(255,255,255,0.05)',animation:'pulse 1.5s ease-in-out infinite',animationDelay:i*0.15+'s'}}/>
                      ))}
                      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
                    </div>
                  )}
                  {s.error && <div style={{fontSize:12,color:'#e05050',background:'rgba(224,80,80,0.08)',padding:'8px 10px',borderRadius:6}}>{s.error}</div>}
                  {s.result && spyResult && <MiniCompareChart stockResult={s.result} spyResult={spyResult} sym={s.sym} color={s.color}/>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
