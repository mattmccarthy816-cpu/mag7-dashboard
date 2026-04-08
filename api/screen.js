// Screener: chart API (always works) + search API for sector enrichment
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

  // Step 1: v8 chart — price, marketCap, history (always works)
  const stocks = {}
  await Promise.all(syms.map(async sym => {
    try {
      for (const host of ['query2', 'query1']) {
        const r = await fetch(
          `https://${host}.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1y`,
          { headers, signal: AbortSignal.timeout(8000) }
        )
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
          price,
          chg1D:      price && prev ? (price - prev) / prev * 100 : null,
          chg1M:      n > 21 ? (price - closes[n - 22]) / closes[n - 22] * 100 : null,
          chg1Y:      n > 1  ? (price - closes[0]) / closes[0] * 100 : null,
          marketCap:  meta.marketCap ?? null,
          week52High: meta.fiftyTwoWeekHigh ?? null,
          week52Low:  meta.fiftyTwoWeekLow  ?? null,
          // Will be enriched below
          trailingPE: null, forwardPE: null, sector: null,
          industry: null, analystRating: null, analystCount: null,
          targetPrice: null, eps: null,
        }
        break
      }
    } catch(e) { console.log(sym, 'chart error:', e.message) }
  }))

  // Step 2: v6/finance/quoteSummary — no crumb needed on this version!
  // This endpoint works without authentication
  await Promise.all(syms.map(async sym => {
    if (!stocks[sym]) return
    try {
      for (const host of ['query2', 'query1']) {
        const r = await fetch(
          `https://${host}.finance.yahoo.com/v6/finance/quoteSummary/${sym}?modules=financialData%2CdefaultKeyStatistics%2CassetProfile%2Cprice`,
          { headers, signal: AbortSignal.timeout(8000) }
        )
        if (!r.ok) continue
        const d = await r.json()
        const result = d?.quoteSummary?.result?.[0]
        if (!result) continue

        const raw = v => typeof v === 'object' && v && 'raw' in v ? v.raw : typeof v === 'number' ? v : null

        const fin   = result.financialData ?? {}
        const stats = result.defaultKeyStatistics ?? {}
        const asset = result.assetProfile ?? {}
        const price = result.price ?? {}

        stocks[sym].sector        = asset.sector   ?? price.sector   ?? null
        stocks[sym].industry      = asset.industry ?? price.industry ?? null
        stocks[sym].trailingPE    = raw(stats.trailingPE)   ?? raw(price.trailingPE)   ?? null
        stocks[sym].forwardPE     = raw(stats.forwardPE)    ?? raw(price.forwardPE)    ?? null
        stocks[sym].analystRating = fin.recommendationKey   ?? price.recommendationKey ?? null
        stocks[sym].analystCount  = raw(fin.numberOfAnalystOpinions) ?? null
        stocks[sym].targetPrice   = raw(fin.targetMeanPrice)         ?? null
        stocks[sym].eps           = raw(stats.trailingEps)           ?? null
        if (raw(price.marketCap) && !stocks[sym].marketCap)
          stocks[sym].marketCap   = raw(price.marketCap)
        break
      }
    } catch(e) { console.log(sym, 'quoteSummary error:', e.message) }
  }))

  return res.status(200).json(Object.values(stocks))
}
