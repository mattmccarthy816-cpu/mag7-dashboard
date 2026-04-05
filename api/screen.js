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

  const results = []

  // Try v7 quote API first (fastest — one call for many symbols)
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=regularMarketPrice,marketCap,trailingPE,forwardPE,shortName,sector,regularMarketChangePercent,fiftyTwoWeekHigh,fiftyTwoWeekLow`
    let r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
    if (!r.ok) r = await fetch(url.replace('query1', 'query2'), { headers, signal: AbortSignal.timeout(10000) })

    if (r.ok) {
      const data = await r.json()
      const quotes = data?.quoteResponse?.result ?? []
      if (quotes.length > 0) {
        quotes.forEach(q => results.push({
          sym:           q.symbol,
          name:          q.shortName ?? q.symbol,
          price:         q.regularMarketPrice ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
          marketCap:     q.marketCap ?? null,
          trailingPE:    q.trailingPE ?? null,
          forwardPE:     q.forwardPE ?? null,
          sector:        q.sector ?? null,
          week52High:    q.fiftyTwoWeekHigh ?? null,
          week52Low:     q.fiftyTwoWeekLow ?? null,
        }))
        return res.status(200).json(results)
      }
    }
  } catch (e) {
    console.log('v7 quote failed:', e.message)
  }

  // Fallback: use v8 chart API (same one that works everywhere else)
  // Fetch in parallel but limit concurrency
  const CONCURRENCY = 8
  for (let i = 0; i < syms.length; i += CONCURRENCY) {
    const batch = syms.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async sym => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`
        let r = await fetch(url, { headers, signal: AbortSignal.timeout(6000) })
        if (!r.ok) r = await fetch(url.replace('query1', 'query2'), { headers, signal: AbortSignal.timeout(6000) })
        if (!r.ok) return

        const data = await r.json()
        const meta = data?.chart?.result?.[0]?.meta
        if (!meta) return

        const price = meta.regularMarketPrice
        const prev  = meta.chartPreviousClose ?? meta.previousClose
        const changePct = price && prev ? ((price - prev) / prev * 100) : null

        results.push({
          sym,
          name:          meta.longName ?? meta.shortName ?? sym,
          price,
          changePercent: changePct,
          marketCap:     meta.marketCap ?? null,
          trailingPE:    null, // not in chart API
          forwardPE:     null,
          sector:        null,
          week52High:    meta.fiftyTwoWeekHigh ?? null,
          week52Low:     meta.fiftyTwoWeekLow  ?? null,
        })
      } catch {}
    }))
  }

  return res.status(200).json(results)
}
