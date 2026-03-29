const PROXY = 'https://corsproxy.io/?'

function proxyUrl(url) {
  return PROXY + encodeURIComponent(url)
}

export async function fetchYahoo(sym, range = '1d', interval = '1d') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`
    const res = await fetch(proxyUrl(url))
    const data = await res.json()
    return data?.chart?.result?.[0] ?? null
  } catch {
    return null
  }
}

export async function fetchFearGreed() {
  try {
    const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/'
    const res = await fetch(proxyUrl(url))
    const data = await res.json()
    const val = Math.round(data?.fear_and_greed?.score ?? data?.score ?? 50)
    const rating = data?.fear_and_greed?.rating ?? scoreToLabel(val)
    return { val, rating }
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
