import React, { useState, useEffect, useRef } from 'react'
import Panel from './Panel'
import { extractCloses, pctChange, fmtMcap } from '../api'

function buildPrompt(activeSector, top7Results, sectorResult, spyResult) {
  const syms = activeSector.top7
  const spyCloses = extractCloses(spyResult)
  const sectorCloses = extractCloses(sectorResult)
  const n = Math.min(sectorCloses.length, spyCloses.length)

  const sectorYr = n > 1 ? pctChange(sectorCloses[n - 1], sectorCloses[0]) : null
  const spyYr = n > 1 ? pctChange(spyCloses[n - 1], spyCloses[0]) : null
  const diff = sectorYr != null && spyYr != null ? sectorYr - spyYr : null

  const stockSummaries = top7Results.map((r, i) => {
    if (!r) return `${syms[i]}: no data`
    const closes = extractCloses(r)
    const price = r.meta.regularMarketPrice
    const prev = r.meta.chartPreviousClose || r.meta.previousClose
    const dayChg = pctChange(price, prev)
    const yrChg = closes.length > 1 ? pctChange(price, closes[0]) : null
    const mcap = r.meta.marketCap
    return `${syms[i]}: price $${price?.toFixed(2)}, day ${dayChg?.toFixed(2)}%, 1yr ${yrChg?.toFixed(1)}%, mcap ${fmtMcap(mcap)}`
  }).join('\n')

  return `You are a concise market analyst. Analyze the ${activeSector.name} sector based on the following data and provide a 3-4 sentence analysis covering: overall sector performance vs the S&P 500, which stocks are leading or lagging, and one key risk or opportunity. Be specific and data-driven. Do not use bullet points.

Sector: ${activeSector.name} (${activeSector.etf})
Sector 1yr return: ${sectorYr?.toFixed(1) ?? '—'}%
S&P 500 1yr return: ${spyYr?.toFixed(1) ?? '—'}%
Sector vs market: ${diff != null ? (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%' : '—'}

Top 7 holdings:
${stockSummaries}`
}

export default function SectorAnalysisPanel({ activeSector, top7Results, sectorResult, spyResult }) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const sectorIdRef = useRef(null)

  const hasData = top7Results.some(Boolean) && spyResult

  useEffect(() => {
    if (!hasData) return
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    sectorIdRef.current = activeSector.id

    setAnalysis('')
    setError(null)
    setLoading(true)

    const prompt = buildPrompt(activeSector, top7Results, sectorResult, spyResult)

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(`API error ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const text = parsed?.delta?.text ?? ''
              if (text && sectorIdRef.current === activeSector.id) {
                setAnalysis(prev => prev + text)
              }
            } catch {}
          }
        }
        setLoading(false)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError('Analysis unavailable')
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [activeSector.id, hasData])

  return (
    <Panel title={`${activeSector.short} Analysis`} badge="AI · live data">
      {loading && !analysis && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Analyzing {activeSector.short} sector data…
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#e05050' }}>{error}</div>
      )}
      {analysis && (
        <div style={{
          fontSize: 12.5,
          lineHeight: 1.7,
          color: 'var(--text-primary)',
        }}>
          {analysis}
          {loading && <span style={{ opacity: 0.4 }}>▌</span>}
        </div>
      )}
      {!loading && !analysis && !error && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting for data…</div>
      )}
    </Panel>
  )
}
