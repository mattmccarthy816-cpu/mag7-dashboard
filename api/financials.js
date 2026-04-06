// Fetch quarterly EPS + key financials for a single symbol
// Uses crumb-authenticated quoteSummary

async function getCrumb(headers) {
  try {
    const cookieRes = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': headers['User-Agent'] },
      signal: AbortSignal.timeout(5000),
    })
    const cookies = cookieRes.headers.get('set-cookie') ?? ''
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...headers, Cookie: cookies },
      signal: AbortSignal.timeout(5000),
    })
    if (!crumbRes.ok) return null
    return { crumb: (await crumbRes.text()).trim(), cookies }
  } catch { return null }
}

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

  // Try with crumb first, then without
  const auth = await getCrumb(headers)
  const symVariants = [symbol, symbol.replace(/-/g, '.')]
  const modules = 'earnings,earningsHistory,financialData,defaultKeyStatistics,assetProfile'

  for (const sym of symVariants) {
    for (const useAuth of [true, false]) {
      if (useAuth && !auth) continue
      try {
        const crumbParam = useAuth ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
        const reqHeaders = useAuth
          ? { ...headers, Cookie: auth.cookies }
          : headers
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${modules}${crumbParam}`
        const r = await fetch(url, { headers: reqHeaders, signal: AbortSignal.timeout(10000) })
        if (!r.ok) {
          console.log(`quoteSummary ${sym} (auth=${useAuth}): ${r.status}`)
          continue
        }
        const data = await r.json()
        const result = data?.quoteSummary?.result?.[0]
        if (!result) {
          console.log(`quoteSummary ${sym}: no result`, JSON.stringify(data?.quoteSummary?.error ?? ''))
          continue
        }

        const earningsHist = result.earningsHistory ?? {}
        const earnings     = result.earnings ?? {}
        const finData      = result.financialData ?? {}
        const keyStats     = result.defaultKeyStatistics ?? {}
        const assetProfile = result.assetProfile ?? {}

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
            epsSurprise: null, surprisePct: null,
          }))
        }

        // Analyst trend
        const trendArr = assetProfile.recommendationTrend?.trend
          ?? finData.recommendationTrend?.trend ?? []
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
            analystRating:    finData.recommendationKey ?? null,
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
        console.log(`financials error (${sym}, auth=${useAuth}):`, e.message)
      }
    }
  }

  // Graceful fallback — return empty rather than 404
  return res.status(200).json({
    symbol, quarters: [], financials: {}, stats: {},
    note: 'Financial data unavailable'
  })
}
