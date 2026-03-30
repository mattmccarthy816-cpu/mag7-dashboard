import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import Panel from './Panel'
import RangeToggle, { RANGES } from './RangeToggle'
import { fmtMcap } from '../api'
import { TICKER_COLORS } from '../constants'

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip)

const SPY_SHARES = 3_300_000_000

function getCloses(result) {
  return result?.indicators?.quote?.[0]?.close ?? []
}
function getTs(result) {
  return result?.timestamp ?? []
}

export default function Top7McapPanel({ allRangeData, activeSector }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const syms = activeSector.top7
  const [activeRange, setActiveRange] = useState('1Y')
  const [status, setStatus] = useState('')

  const rangeData = allRangeData?.[activeRange]
  const top7Results = rangeData?.top7 ?? []
  const spyResult = rangeData?.spy ?? null

  useEffect(()=>{
    if(chartRef.current){chartRef.current.destroy();chartRef.current=null}
    if(!canvasRef.current)return

    // Raw arrays — don't filter nulls, keep them to preserve alignment
    const spyRaw = getCloses(spyResult)
    const spyTs = getTs(spyResult)

    if(!spyResult||spyRaw.length<2){setStatus('Waiting for SPY data…');return}

    // Build per-stock data aligned to SPY timestamps
    const stocks = top7Results.map((r,i)=>{
      if(!r)return null
      const closes = getCloses(r)
      const ts = getTs(r)
      const price = r.meta?.regularMarketPrice
      const mcap = r.meta?.marketCap
      if(!closes.length||!price||!mcap)return null

      const sharesOut = mcap / price

      // Build a map of timestamp→close for this stock
      const tsMap = {}
      ts.forEach((t,j)=>{ if(closes[j]!=null) tsMap[t]=closes[j] })

      return { sym:syms[i], tsMap, sharesOut, mcap, color:TICKER_COLORS[i] }
    })

    const valid = stocks.filter(Boolean)
    if(!valid.length){setStatus('No stock data');return}

    // Sample 40 points from SPY timeline
    const step = Math.max(1,Math.floor(spyRaw.length/40))
    const indices=[]
    for(let i=0;i<spyRaw.length;i+=step)indices.push(i)
    if(indices[indices.length-1]!==spyRaw.length-1)indices.push(spyRaw.length-1)

    const labels=indices.map(i=>{
      const t=spyTs[i]; if(!t)return ''
      return new Date(t*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})
    })

    // For each sampled point, find spy close and each stock's close by matching timestamps
    const datasets = stocks.map((s,idx)=>{
      if(!s){
        return{label:syms[idx],data:Array(indices.length).fill(0),backgroundColor:'transparent',stack:'mcap',borderWidth:0}
      }
      const data = indices.map(i=>{
        const spyClose = spyRaw[i]
        const t = spyTs[i]
        if(!spyClose||!t||spyClose===0)return 0

        // Find stock's closest close — try exact timestamp, then nearby
        let stockClose = s.tsMap[t]
        if(stockClose==null){
          // fallback: find nearest timestamp within 2 days
          const nearby=Object.keys(s.tsMap).map(Number).filter(st=>Math.abs(st-t)<172800).sort((a,b)=>Math.abs(a-t)-Math.abs(b-t))
          stockClose=nearby.length?s.tsMap[nearby[0]]:null
        }
        if(!stockClose)return 0

        return +((stockClose*s.sharesOut)/(spyClose*SPY_SHARES)*100).toFixed(4)
      })

      // Sanity: log first non-zero
      const firstNZ=data.find(v=>v>0)
      console.log(`[Mcap] ${s.sym}: first%=${firstNZ?.toFixed(3)}, sharesOut=${s.sharesOut.toFixed(0)}`)

      return{label:s.sym,data,backgroundColor:s.color+'cc',borderWidth:0,stack:'mcap'}
    })

    const firstTotal=datasets.reduce((sum,ds)=>sum+(ds.data[0]||0),0)
    setStatus(`${valid.length}/7 loaded · ~${firstTotal.toFixed(1)}% of S&P 500`)

    chartRef.current=new Chart(canvasRef.current,{
      type:'bar', data:{labels,datasets},
      options:{
        responsive:true,maintainAspectRatio:false,animation:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{
            label:ctx=>{const v=ctx.parsed.y;if(!v||v<0.001)return null;return` ${ctx.dataset.label}: ${v.toFixed(2)}% of S&P 500`},
            footer:items=>{const t=items.reduce((s,i)=>s+(i.parsed.y||0),0);return t>0.01?`Combined: ${t.toFixed(2)}%`:null},
          }},
        },
        scales:{
          x:{stacked:true,grid:{display:false},ticks:{color:'#555',font:{size:10},maxTicksLimit:8,maxRotation:0}},
          y:{stacked:true,grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#555',font:{size:10},callback:v=>v.toFixed(1)+'%'}},
        },
      },
    })
    return()=>{if(chartRef.current){chartRef.current.destroy();chartRef.current=null}}
  },[top7Results,spyResult,activeSector,activeRange])

  return (
    <Panel title={`Top 7 ${activeSector.short} — Share of S&P 500`} badge="stacked">
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
        <RangeToggle active={activeRange} onChange={r=>setActiveRange(r.label)} color={activeSector.color}/>
      </div>
      <div style={{position:'relative',width:'100%',height:195}}>
        <canvas ref={canvasRef}/>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'5px 12px',marginTop:8}}>
        {syms.map((sym,i)=>{
          const r=top7Results[i]
          return(
            <span key={sym} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-secondary)'}}>
              <span style={{width:7,height:7,borderRadius:2,background:TICKER_COLORS[i],display:'inline-block'}}/>
              {sym} {r?.meta?.marketCap?fmtMcap(r.meta.marketCap):'—'}
            </span>
          )
        })}
      </div>
      {status&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:5,opacity:0.65}}>{status}</div>}
    </Panel>
  )
}
