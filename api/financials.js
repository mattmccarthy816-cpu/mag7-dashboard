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

  // Yahoo uses different symbol formats — try both
  const symVariants = [symbol, symbol.replace('-', '.')]
  const raw = v => (typeof v === 'object' && v !== null && 'raw' in v) ? v.raw : (typeof v === 'number' ? v : null)

  for (const sym of symVariants) {
    for (const host of ['query2', 'query1']) {
      try {
        const modules = 'earnings,earningsHistory,financialData,defaultKeyStatistics,price'
        const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${modules}`
        const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })

        if (!r.ok) {
          const body = await r.text()
          console.log(`${host}/${sym} returned ${r.status}:`, body.slice(0, 200))
          continue
        }

        const data = await r.json()
        const result = data?.quoteSummary?.result?.[0]

        if (!result) {
          console.log(`${host}/${sym} no result. Error:`, JSON.stringify(data?.quoteSummary?.error))
          continue
        }

        const earningsHist = result.earningsHistory ?? {}
        const earnings     = result.earnings ?? {}
        const finData      = result.financialData ?? {}
        const keyStats     = result.defaultKeyStatistics ?? {}
        const priceData    = result.price ?? {}

        // Quarterly EPS
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
          const chartQ = earnings.earningsChart?.quarterly ?? []
          quarters = chartQ.slice(-4).map(q => ({
            date:        String(q.date ?? ''),
            epsActual:   raw(q.actual),
            epsEstimate: raw(q.estimate),
            epsSurprise: null,
            surprisePct: null,
          }))
        }

        // Analyst trend
        const trendArr = finData.recommendationTrend?.trend ?? []
        const trend = trendArr[0] ?? {}

        return res.status(200).json({
          symbol: sym,
          quarters,
          financials: {
            revenueGrowth:    raw(finData.revenueGrowth),
            grossMargins:     raw(finData.grossMargins),
            operatingMargins: raw(finData.operatingMargins),
            profitMargins:    raw(finData.profitMargins),
            returnOnEquity:   raw(finData.returnOnEquity),
            debtToEquity:     raw(finData.debtToEquity),
            currentRatio:     raw(finData.currentRatio),
            freeCashflow:     raw(finData.freeCashflow),
            analystRating:    finData.recommendationKey ?? priceData.recommendationKey ?? null,
            targetPrice:      raw(finData.targetMeanPrice),
            targetLow:        raw(finData.targetLowPrice),
            targetHigh:       raw(finData.targetHighPrice),
            analystCount:     raw(finData.numberOfAnalystOpinions),
            strongBuy:        trend.strongBuy  ?? null,
            buy:              trend.buy        ?? null,
            hold:             trend.hold       ?? null,
            sell:             trend.sell       ?? null,
            strongSell:       trend.strongSell ?? null,
          },
          stats: {
            beta:        raw(keyStats.beta),
            shortRatio:  raw(keyStats.shortRatio),
            bookValue:   raw(keyStats.bookValue),
            priceToBook: raw(keyStats.priceToBook),
            pegRatio:    raw(keyStats.pegRatio),
          }
        })
      } catch (e) {
        console.log(`financials ${host}/${sym} threw:`, e.message)
      }
    }
  }

  // Return empty structure instead of 404 — frontend handles missing data gracefully
  return res.status(200).json({
    symbol,
    quarters: [],
    financials: {},
    stats: {},
    note: 'No data available from Yahoo Finance for this symbol'
  })
}
