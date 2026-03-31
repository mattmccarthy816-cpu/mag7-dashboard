// Earnings dates via Yahoo Finance chart meta — most reliable free approach
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols required' })

  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
  }

  const results = await Promise.all(syms.map(async sym => {
    // Method 1: quoteSummary calendarEvents (best data, sometimes rate limited)
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=calendarEvents`
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const data = await r.json()
        const dates = data?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate ?? []
        if (dates.length) {
          return { sym, nextEarnings: dates[0].raw }
        }
      }
    } catch {}

    // Method 2: chart API meta earningsTimestamp fields
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const data = await r.json()
        const meta = data?.chart?.result?.[0]?.meta ?? {}
        // earningsTimestampEnd is the END of the earnings window (most accurate)
        const ts = meta.earningsTimestampEnd ?? meta.earningsTimestamp ?? meta.earningsTimestampStart ?? null
        if (ts) return { sym, nextEarnings: ts }
      }
    } catch {}

    return { sym, nextEarnings: null }
  }))

  return res.status(200).json(results)
}
