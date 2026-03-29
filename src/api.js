// All data fetching via our own Vercel serverless functions in /api/

export async function fetchYahooMany(syms, range = '1y', interval = '1d') {
  try {
    const res = await fetch(`/api/quote?symbols=${syms.join(',')}&range=${range}&interval=${interval}`)
    if (!res.ok) return syms.map(() => null)
    const data = await res.json()
    return data.map(entry => entry?.data ?? null)
  } catch {
    return syms.map(() => null)
  }
}

export async function fetchFearGreed() {
  try {
    const res = await fetch('/api/feargreed')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export function scoreToLabel(val) {
  if (val <= 25) return 'Extreme Fear'
  if (val <= 45) return 'Fear'
  if (val <= 55) return 'Neutral'
  if (val <= 75) return 'Greed'
  return 'Extreme Greed'
}

export function fmtPrice(v) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtMcap(v) {
  if (!v) return '—'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B'
  return '$' + v.toFixed(0)
}

export function pctChange(current, prev) {
  if (!prev) return null
  return (current - prev) / prev * 100
}

export function extractCloses(result) {
  return result?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
}

export function extractTimestamps(result) {
  return result?.timestamp ?? []
}
