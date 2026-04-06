// Screener: reliable two-step approach
// Step 1: v8 chart for price/mcap/performance (always works)
// Step 2: quoteSummary for PE/sector/analyst (best effort, per symbol)
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

  async function tryFetch(url) {
    for (const host of ['query2', 'query1']) {
      try {
        const u = url.replace('HOSTPLACEHOLDER', host)
        const r = await fetch(u, { headers, signal: AbortSignal.timeout(8000) })
        if (r.ok) return r.json()
      } catch {}
    }
    return null
  }

  // Step 1: chart API — price, mcap, 1D change, 52w range
  const stocks = {}
  await Promise.all(syms.map(async sym => {
    const data = await tryFetch(
      `https://HOSTPLACEHOLDER.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1y`
    )
    const result = data?.chart?.result?.[0]
    if (!result) return
    const meta = result.meta
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(v => v != null)
    const n = closes.length
    const price = meta.regularMarketPrice
    const prev  = meta.chartPreviousClose ?? meta.previousClose

    stocks[sym] = {
      sym,
      name:      meta.longName ?? meta.shortName ?? sym,
      price:     price ?? null,
      chg1D:     price && prev ? (price - prev) / prev * 100 : null,
      chg1M:     n > 21 ? (price - closes[n - 22]) / closes[n - 22] * 100 : null,
      chg1Y:     n > 1  ? (price - closes[0])      / closes[0]      * 100 : null,
      marketCap: meta.marketCap ?? null,
      week52High:meta.fiftyTwoWeekHigh ?? null,
      week52Low: meta.fiftyTwoWeekLow  ?? null,
      trailingPE:   null,
      forwardPE:    null,
      sector:       null,
      industry:     null,
      analystRating:null,
      analystCount: null,
      targetPrice:  null,
      eps:          null,
      epsForward:   null,
    }
  }))

  // Step 2: quoteSummary for PE, sector, analyst — one symbol at a time is reliable
  await Promise.all(syms.map(async sym => {
    if (!stocks[sym]) return
    const data = await tryFetch(
      `https://HOSTPLACEHOLDER.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=price,defaultKeyStatistics,financialData`
    )
    const r = data?.quoteSummary?.result?.[0]
    if (!r) return

    const price    = r.price ?? {}
    const keyStats = r.defaultKeyStatistics ?? {}
    const finData  = r.financialData ?? {}

    // price module has sector, PE, analyst rating
    if (price.sector)                          stocks[sym].sector        = price.sector
    if (price.industry)                        stocks[sym].industry      = price.industry
    if (typeof price.trailingPE?.raw === 'number') stocks[sym].trailingPE = price.trailingPE.raw
    if (typeof price.forwardPE?.raw  === 'number') stocks[sym].forwardPE  = price.forwardPE.raw
    if (price.marketCap?.raw)                  stocks[sym].marketCap     = price.marketCap.raw
    if (price.recommendationKey)               stocks[sym].analystRating = price.recommendationKey
    if (typeof keyStats.trailingEps?.raw === 'number') stocks[sym].eps   = keyStats.trailingEps.raw
    if (typeof keyStats.forwardEps?.raw  === 'number') stocks[sym].epsForward = keyStats.forwardEps.raw
    if (typeof finData.targetMeanPrice?.raw === 'number') stocks[sym].targetPrice = finData.targetMeanPrice.raw
    if (typeof finData.numberOfAnalystOpinions?.raw === 'number') stocks[sym].analystCount = finData.numberOfAnalystOpinions.raw
  }))

  return res.status(200).json(Object.values(stocks))
}
