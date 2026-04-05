// Batch fetch fundamental data for screener: price, marketCap, PE, sector, name
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
  }

  // Yahoo v7 quote returns fundamentals for up to 50 symbols at once
  const CHUNK = 50
  const results = []
  for (let i = 0; i < syms.length; i += CHUNK) {
    const chunk = syms.slice(i, i + CHUNK)
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${chunk.join(',')}&fields=regularMarketPrice,marketCap,trailingPE,forwardPE,shortName,sector,regularMarketChangePercent,fiftyTwoWeekHigh,fiftyTwoWeekLow,regularMarketVolume,averageVolume`
      let r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
      if (!r.ok) r = await fetch(url.replace('query1','query2'), { headers, signal: AbortSignal.timeout(8000) })
      if (r.ok) {
        const data = await r.json()
        const quotes = data?.quoteResponse?.result ?? []
        quotes.forEach(q => {
          results.push({
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
            volume:        q.regularMarketVolume ?? null,
            avgVolume:     q.averageVolume ?? null,
          })
        })
      }
    } catch {}
    // Small delay between chunks to avoid rate limiting
    if (i + CHUNK < syms.length) await new Promise(r => setTimeout(r, 200))
  }

  return res.status(200).json(results)
}
