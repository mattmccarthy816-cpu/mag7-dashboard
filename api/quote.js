// Vercel serverless function — runs on the server, bypasses CORS entirely
// Called by the frontend as /api/quote?symbols=AAPL,MSFT&range=1y

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbols, range = '1y', interval = '1d' } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols required' })

  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean)

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
  }

  const results = await Promise.all(syms.map(async (sym) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}&includePrePost=false`
      const r = await fetch(url, { headers })
      if (!r.ok) {
        // try query2 as fallback
        const r2 = await fetch(url.replace('query1', 'query2'), { headers })
        if (!r2.ok) return { sym, error: r2.status }
        const d2 = await r2.json()
        return { sym, data: d2?.chart?.result?.[0] ?? null }
      }
      const d = await r.json()
      return { sym, data: d?.chart?.result?.[0] ?? null }
    } catch (e) {
      return { sym, error: e.message }
    }
  }))

  return res.status(200).json(results)
}
