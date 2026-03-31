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
    // Try both query endpoints and both module combos
    const urls = [
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=calendarEvents`,
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=calendarEvents`,
    ]
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers })
        if (!r.ok) continue
        const data = await r.json()
        const result = data?.quoteSummary?.result?.[0]
        if (!result) continue
        const earningsDates = result.calendarEvents?.earnings?.earningsDate ?? []
        const nextTs = earningsDates.length ? earningsDates[0]?.raw : null
        return { sym, nextEarnings: nextTs }
      } catch {}
    }

    // Fallback: use chart API meta field which sometimes has earningsTimestamp
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`
      const r = await fetch(url, { headers })
      if (r.ok) {
        const data = await r.json()
        const meta = data?.chart?.result?.[0]?.meta
        const ts = meta?.earningsTimestamp ?? meta?.earningsTimestampStart ?? null
        return { sym, nextEarnings: ts }
      }
    } catch {}

    return { sym, nextEarnings: null }
  }))

  return res.status(200).json(results)
}
