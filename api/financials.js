// Fetch quarterly earnings history for a single stock
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }

  const modules = 'earnings,earningsHistory,defaultKeyStatistics,financialData'

  for (const host of ['query1','query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
      if (!r.ok) continue
      const data = await r.json()
      const result = data?.quoteSummary?.result?.[0]
      if (!result) continue

      // Quarterly EPS history
      const qHistory = result.earningsHistory?.history ?? []
      const quarters = qHistory.slice(-4).map(q => ({
        date:        q.quarter?.fmt ?? null,
        epsActual:   q.epsActual?.raw ?? null,
        epsEstimate: q.epsEstimate?.raw ?? null,
        epsSurprise: q.epsDifference?.raw ?? null,
        surprisePct: q.surprisePercent?.raw ?? null,
      }))

      // Earnings chart (annual + quarterly)
      const earningsChart = result.earnings?.earningsChart
      const quarterly = earningsChart?.quarterly ?? []
      const quartersChart = quarterly.slice(-4).map(q => ({
        date:     q.date ?? null,
        actual:   q.actual?.raw ?? null,
        estimate: q.estimate?.raw ?? null,
      }))

      // Financial data (revenue, margins, etc.)
      const fin = result.financialData ?? {}
      const stats = result.defaultKeyStatistics ?? {}

      return res.status(200).json({
        symbol,
        quarters: quarters.length ? quarters : quartersChart,
        financials: {
          revenueGrowth:    fin.revenueGrowth?.raw ?? null,
          grossMargins:     fin.grossMargins?.raw ?? null,
          operatingMargins: fin.operatingMargins?.raw ?? null,
          profitMargins:    fin.profitMargins?.raw ?? null,
          returnOnEquity:   fin.returnOnEquity?.raw ?? null,
          debtToEquity:     fin.debtToEquity?.raw ?? null,
          currentRatio:     fin.currentRatio?.raw ?? null,
          freeCashflow:     fin.freeCashflow?.raw ?? null,
          analystRating:    fin.recommendationKey ?? null,
          targetPrice:      fin.targetMeanPrice?.raw ?? null,
          targetLow:        fin.targetLowPrice?.raw ?? null,
          targetHigh:       fin.targetHighPrice?.raw ?? null,
          analystCount:     fin.numberOfAnalystOpinions?.raw ?? null,
          // Analyst breakdown
          strongBuy:        fin.recommendationTrend?.trend?.[0]?.strongBuy ?? null,
          buy:              fin.recommendationTrend?.trend?.[0]?.buy ?? null,
          hold:             fin.recommendationTrend?.trend?.[0]?.hold ?? null,
          sell:             fin.recommendationTrend?.trend?.[0]?.sell ?? null,
          strongSell:       fin.recommendationTrend?.trend?.[0]?.strongSell ?? null,
        },
        stats: {
          beta:             stats.beta?.raw ?? null,
          shortRatio:       stats.shortRatio?.raw ?? null,
          sharesShort:      stats.sharesShort?.raw ?? null,
          floatShares:      stats.floatShares?.raw ?? null,
          bookValue:        stats.bookValue?.raw ?? null,
          priceToBook:      stats.priceToBook?.raw ?? null,
          pegRatio:         stats.pegRatio?.raw ?? null,
        }
      })
    } catch(e) {
      console.log(`${host} financials failed:`, e.message)
    }
  }

  return res.status(404).json({ error: 'No data found' })
}
