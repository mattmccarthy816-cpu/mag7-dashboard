export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }

  const raw = v => typeof v === 'object' && v && 'raw' in v ? v.raw : typeof v === 'number' ? v : null
  // Yahoo uses BRK.B not BRK-B in some endpoints
  const symVariants = [...new Set([symbol, symbol.replace(/-/g, '.')])]
  const modules = 'earnings,earningsHistory,financialData,defaultKeyStatistics,assetProfile'

  for (const sym of symVariants) {
    for (const host of ['query2', 'query1']) {
      try {
        // Use v6 — no crumb required
        const r = await fetch(
          `https://${host}.finance.yahoo.com/v6/finance/quoteSummary/${sym}?modules=${encodeURIComponent(modules)}`,
          { headers, signal: AbortSignal.timeout(10000) }
        )
        if (!r.ok) { console.log(`${host}/${sym}: ${r.status}`); continue }
        const data = await r.json()
        const result = data?.quoteSummary?.result?.[0]
        if (!result) { console.log(`${host}/${sym}: no result`); continue }

        const earningsHist = result.earningsHistory ?? {}
        const earnings     = result.earnings ?? {}
        const fin          = result.financialData ?? {}
        const stats        = result.defaultKeyStatistics ?? {}

        // Quarterly EPS — earningsHistory is more detailed
        let quarters = []
        const histQ = earningsHist.history ?? []
        if (histQ.length) {
          quarters = histQ.slice(-4).map(q => ({
            date:        q.quarter?.fmt ?? String(q.quarter ?? ''),
            epsActual:   raw(q.epsActual),
            epsEstimate: raw(q.epsEstimate),
            epsSurprise: raw(q.epsDifference),
            surprisePct: raw(q.surprisePercent),
          }))
        } else {
          // Fallback to earnings chart quarterly data
          const chartQ = earnings.earningsChart?.quarterly ?? []
          quarters = chartQ.slice(-4).map(q => ({
            date:        String(q.date ?? ''),
            epsActual:   raw(q.actual),
            epsEstimate: raw(q.estimate),
            epsSurprise: null, surprisePct: null,
          }))
        }

        // Analyst trend breakdown
        const trendArr = fin.recommendationTrend?.trend ?? []
        const trend = trendArr[0] ?? {}

        return res.status(200).json({
          symbol: sym,
          quarters,
          financials: {
            revenueGrowth:    raw(fin.revenueGrowth),
            grossMargins:     raw(fin.grossMargins),
            operatingMargins: raw(fin.operatingMargins),
            profitMargins:    raw(fin.profitMargins),
            returnOnEquity:   raw(fin.returnOnEquity),
            debtToEquity:     raw(fin.debtToEquity),
            currentRatio:     raw(fin.currentRatio),
            freeCashflow:     raw(fin.freeCashflow),
            analystRating:    fin.recommendationKey ?? null,
            targetPrice:      raw(fin.targetMeanPrice),
            targetLow:        raw(fin.targetLowPrice),
            targetHigh:       raw(fin.targetHighPrice),
            analystCount:     raw(fin.numberOfAnalystOpinions),
            strongBuy:        trend.strongBuy  ?? null,
            buy:              trend.buy        ?? null,
            hold:             trend.hold       ?? null,
            sell:             trend.sell       ?? null,
            strongSell:       trend.strongSell ?? null,
          },
          stats: {
            beta:        raw(stats.beta),
            shortRatio:  raw(stats.shortRatio),
            bookValue:   raw(stats.bookValue),
            priceToBook: raw(stats.priceToBook),
            pegRatio:    raw(stats.pegRatio),
          }
        })
      } catch(e) {
        console.log(`financials ${host}/${sym}:`, e.message)
      }
    }
  }

  return res.status(200).json({
    symbol, quarters: [], financials: {}, stats: {},
    note: 'Financial data unavailable'
  })
}
