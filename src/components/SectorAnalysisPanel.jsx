import React, { useState, useRef } from 'react'
import Panel from './Panel'
import { extractCloses, pctChange, fmtMcap } from '../api'

function buildPrompt(activeSector, top7Results, sectorResult, spyResult) {
  const syms = activeSector.top7
  const spyCloses = extractCloses(spyResult || {})
  const sectorCloses = extractCloses(sectorResult || {})
  const n = Math.min(sectorCloses.length, spyCloses.length)
  const sectorYr = n > 1 ? pctChange(sectorCloses[n-1], sectorCloses[0]) : null
  const spyYr = n > 1 ? pctChange(spyCloses[n-1], spyCloses[0]) : null
  const diff = sectorYr != null && spyYr != null ? sectorYr - spyYr : null

  const stockSummaries = top7Results.map((r, i) => {
    if (!r) return `${syms[i]}: no data`
    const closes = extractCloses(r)
    const price = r.meta?.regularMarketPrice
    const prev = r.meta?.chartPreviousClose || r.meta?.previousClose
    return `${syms[i]}: $${price?.toFixed(2)}, day ${pctChange(price,prev)?.toFixed(2)}%, 1yr ${closes.length>1?pctChange(price,closes[0])?.toFixed(1):'?'}%, mcap ${fmtMcap(r.meta?.marketCap)}`
  }).join('\n')

  return `You are a concise market analyst. Analyze the ${activeSector.name} sector and provide exactly 3 sentences: (1) overall sector performance vs the S&P 500, (2) which stocks are leading or lagging and why, (3) one key risk or opportunity. Be specific and data-driven. No bullet points. No preamble.

Sector: ${activeSector.name} (${activeSector.etf})
Sector 1yr: ${sectorYr?.toFixed(1) ?? '?'}%
S&P 500 1yr: ${spyYr?.toFixed(1) ?? '?'}%
Outperformance: ${diff != null ? (diff>=0?'+':'')+diff.toFixed(1) : '?'}%

Holdings:
${stockSummaries}`
}

export default function SectorAnalysisPanel({ activeSector, top7Results, sectorResult, spyResult }) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasRun, setHasRun] = useState(false)
  const abortRef = useRef(null)

  // Reset when sector changes
  const sectorIdRef = useRef(activeSector.id)
  if (sectorIdRef.current !== activeSector.id) {
    sectorIdRef.current = activeSector.id
    // Can't call setState in render body safely, so use a key on the parent instead
  }

  const hasData = top7Results.some(Boolean) && spyResult

  const runAnalysis = () => {
    if (!hasData || loading) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAnalysis(''); setError(null); setLoading(true); setHasRun(true)

    fetch('/api/analyze', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: buildPrompt(activeSector, top7Results, sectorResult, spyResult) }],
      }),
    })
    .then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      return data
    })
    .then(data => {
      const text = data?.content?.[0]?.text ?? ''
      if (!text) throw new Error('Empty response')
      setAnalysis(text); setLoading(false)
    })
    .catch(err => {
      if (err.name === 'AbortError') return
      setError(err.message); setLoading(false)
    })
  }

  return (
    <Panel title={`${activeSector.short} Analysis`} badge="AI · on demand">
      {!hasRun && !loading && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'16px 0' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', lineHeight:1.6 }}>
            Get an AI-powered analysis of the {activeSector.short} sector based on current price data.
          </div>
          <button
            onClick={runAnalysis}
            disabled={!hasData}
            style={{
              fontSize:12, fontWeight:600,
              padding:'8px 20px',
              background: hasData ? activeSector.color + '22' : 'var(--bg-secondary)',
              border: `1px solid ${hasData ? activeSector.color + '66' : 'var(--border)'}`,
              borderRadius:8,
              color: hasData ? activeSector.color : 'var(--text-muted)',
              cursor: hasData ? 'pointer' : 'default',
            }}
          >
            ✦ Analyze {activeSector.short}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, fontStyle:'italic' }}>
            Analyzing {activeSector.short} sector…
          </div>
          {[100,80,65].map((w,i) => (
            <div key={i} style={{ height:11, borderRadius:4, width:w+'%', background:'var(--bg-secondary)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:i*0.15+'s' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
        </div>
      )}

      {error && !loading && (
        <div>
          <div style={{ fontSize:11, color:'#e05050', lineHeight:1.6, background:'rgba(224,80,80,0.08)', borderRadius:6, padding:'8px 10px', marginBottom:10 }}>
            {error}
          </div>
          <button onClick={runAnalysis} style={{ fontSize:11, padding:'5px 14px', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:6, color:'var(--text-secondary)', cursor:'pointer' }}>
            ↻ Retry
          </button>
        </div>
      )}

      {analysis && !loading && (
        <div>
          <div style={{ fontSize:12.5, lineHeight:1.75, color:'var(--text-primary)' }}>{analysis}</div>
          <button
            onClick={runAnalysis}
            style={{ marginTop:12, fontSize:11, padding:'4px 12px', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:6, color:'var(--text-muted)', cursor:'pointer' }}
          >
            ↻ Refresh analysis
          </button>
        </div>
      )}
    </Panel>
  )
}
