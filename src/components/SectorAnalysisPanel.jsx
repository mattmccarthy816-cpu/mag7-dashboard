import React, { useState, useEffect, useRef } from 'react'
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
  const requestIdRef = useRef(0)
  const hasData = top7Results.some(Boolean) && spyResult

  useEffect(() => {
    if (!hasData) return
    const myId = ++requestIdRef.current
    setAnalysis(''); setError(null); setLoading(true)

    fetch('/api/analyze', {
      method: 'POST',
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
      if (requestIdRef.current !== myId) return
      const text = data?.content?.[0]?.text ?? ''
      if (!text) throw new Error('Empty response from API')
      setAnalysis(text); setLoading(false)
    })
    .catch(err => {
      if (requestIdRef.current !== myId) return
      setError(err.message)
      setLoading(false)
    })
  }, [activeSector.id, hasData])

  return (
    <Panel title={`${activeSector.short} Analysis`} badge="AI · live data">
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[100,85,70].map((w,i) => (
            <div key={i} style={{ height:12, borderRadius:4, width:w+'%', background:'var(--bg-secondary)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:i*0.2+'s' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
        </div>
      )}
      {error && !loading && (
        <div style={{ fontSize:11, color:'#e05050', lineHeight:1.6, background:'rgba(224,80,80,0.08)', borderRadius:6, padding:'8px 10px' }}>
          {error}
        </div>
      )}
      {analysis && !loading && (
        <div style={{ fontSize:12.5, lineHeight:1.75, color:'var(--text-primary)' }}>{analysis}</div>
      )}
      {!loading && !analysis && !error && (
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>Waiting for data…</div>
      )}
    </Panel>
  )
}
