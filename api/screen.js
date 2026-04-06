// Screener endpoint - fetches price data + fundamental enrichment
// Uses crumb-authenticated v7/quote for PE, sector, analyst data

async function getCrumb(headers) {
  try {
    // First get a cookie by visiting Yahoo Finance
    const cookieRes = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': headers['User-Agent'] },
      signal: AbortSignal.timeout(5000),
    })
    const cookies = cookieRes.headers.get('set-cookie') ?? ''

    // Then get crumb
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...headers, Cookie: cookies },
      signal: AbortSignal.timeout(5000),
    })
    if (!crumbRes.ok) return null
    const crumb = await crumbRes.text()
    return { crumb: crumb.trim(), cookies }
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols required' })

  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
  }

  // Step 1: Chart API for price + history (always works, no auth needed)
  const stocks = {}
  await Promise.all(syms.map(async sym => {
    try {
      for (const host of ['query2', 'query1']) {
        const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1y`
        const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
        if (!r.ok) continue
        const d = await r.json()
        const result = d?.chart?.result?.[0]
        if (!result) continue
        const meta = result.meta
        const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(v => v != null)
        const n = closes.length
        const price = meta.regularMarketPrice
        const prev  = meta.chartPreviousClose ?? meta.previousClose

        stocks[sym] = {
          sym,
          name:       meta.longName ?? meta.shortName ?? sym,
          price:      price ?? null,
          chg1D:      price && prev ? (price - prev) / prev * 100 : null,
          chg1M:      n > 21 ? (price - closes[n - 22]) / closes[n - 22] * 100 : null,
          chg1Y:      n > 1  ? (price - closes[0]) / closes[0] * 100 : null,
          marketCap:  meta.marketCap ?? null,
          week52High: meta.fiftyTwoWeekHigh ?? null,
          week52Low:  meta.fiftyTwoWeekLow  ?? null,
          trailingPE: null, forwardPE: null, sector: null,
          industry: null, analystRating: null, analystCount: null,
          targetPrice: null, eps: null, epsForward: null,
        }
        break
      }
    } catch {}
  }))

  // Step 2: v7/quote with crumb for PE, sector, analyst data
  const auth = await getCrumb(headers)
  if (auth) {
    const { crumb, cookies } = auth
    const enrichHeaders = { ...headers, Cookie: cookies }
    const fields = 'trailingPE,forwardPE,sector,industry,recommendationKey,numberOfAnalystOpinions,targetMeanPrice,epsTrailingTwelveMonths,epsForward,shortName,marketCap'

    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=${fields}&crumb=${encodeURIComponent(crumb)}`
      const r = await fetch(url, { headers: enrichHeaders, signal: AbortSignal.timeout(10000) })
      if (r.ok) {
        const data = await r.json()
        const quotes = data?.quoteResponse?.result ?? []
        quotes.forEach(q => {
          if (!stocks[q.symbol]) return
          const s = stocks[q.symbol]
          if (typeof q.trailingPE === 'number')               s.trailingPE   = q.trailingPE
          if (typeof q.forwardPE  === 'number')               s.forwardPE    = q.forwardPE
          if (q.sector)                                       s.sector       = q.sector
          if (q.industry)                                     s.industry     = q.industry
          if (q.recommendationKey)                            s.analystRating = q.recommendationKey
          if (typeof q.numberOfAnalystOpinions === 'number')  s.analystCount  = q.numberOfAnalystOpinions
          if (typeof q.targetMeanPrice === 'number')          s.targetPrice   = q.targetMeanPrice
          if (typeof q.epsTrailingTwelveMonths === 'number')  s.eps           = q.epsTrailingTwelveMonths
          if (typeof q.epsForward === 'number')               s.epsForward    = q.epsForward
          if (typeof q.marketCap === 'number' && !s.marketCap) s.marketCap   = q.marketCap
        })
      }
    } catch (e) {
      console.log('v7 enrichment failed:', e.message)
    }
  }

  return res.status(200).json(Object.values(stocks))
}
