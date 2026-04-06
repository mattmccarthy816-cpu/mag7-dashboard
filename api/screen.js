// Screener: fetch fundamentals for a batch of symbols
// Uses v8 chart (reliable) + v7 quote (for PE/sector/analyst when available)
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

  // Step 1: Fetch 1Y chart data for all symbols (this always works — same as rest of app)
  // Gets: price, changePercent, marketCap, 1D/1M/1Y history
  const chartMap = {}
  const CONC = 8
  await Promise.all(
    Array.from({length: Math.ceil(syms.length/CONC)}, (_,i) => syms.slice(i*CONC, (i+1)*CONC))
      .map(async batch => {
        await Promise.all(batch.map(async sym => {
          try {
            for (const host of ['query2','query1']) {
              const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1y`
              const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
              if (!r.ok) continue
              const d = await r.json()
              const result = d?.chart?.result?.[0]
              if (!result) continue
              const meta = result.meta
              const closes = result.indicators?.quote?.[0]?.close ?? []
              const validCloses = closes.filter(v => v != null)
              const n = validCloses.length
              const price = meta.regularMarketPrice
              const prev  = meta.chartPreviousClose ?? meta.previousClose

              chartMap[sym] = {
                sym,
                name:      meta.longName ?? meta.shortName ?? sym,
                price:     price ?? null,
                chg1D:     price && prev ? (price - prev) / prev * 100 : null,
                chg1M:     n > 21 ? (price - validCloses[n-22]) / validCloses[n-22] * 100 : null,
                chg1Y:     n > 1  ? (price - validCloses[0])    / validCloses[0]    * 100 : null,
                marketCap: meta.marketCap ?? null,
                week52High:meta.fiftyTwoWeekHigh ?? null,
                week52Low: meta.fiftyTwoWeekLow  ?? null,
                // These come from v7 enrichment below
                trailingPE:   null,
                forwardPE:    null,
                sector:       null,
                industry:     null,
                analystRating:null,
                analystCount: null,
                targetPrice:  null,
                eps:          null,
                epsForward:   null,
                divYield:     null,
              }
              break
            }
          } catch {}
        }))
      })
  )

  // Step 2: Enrich with v7 quote (PE, sector, analyst) — best effort
  const fields = [
    'trailingPE','forwardPE','priceToBook','sector','industry',
    'recommendationKey','numberOfAnalystOpinions','targetMeanPrice',
    'epsTrailingTwelveMonths','epsForward','dividendYield',
    'shortName',
  ].join(',')

  for (const host of ['query2','query1']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=${fields}&formatted=false&crumb=`
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!r.ok) continue
      const data = await r.json()
      const quotes = data?.quoteResponse?.result ?? []
      if (!quotes.length) continue
      quotes.forEach(q => {
        if (!chartMap[q.symbol]) return
        chartMap[q.symbol].trailingPE    = typeof q.trailingPE === 'number' ? q.trailingPE : null
        chartMap[q.symbol].forwardPE     = typeof q.forwardPE  === 'number' ? q.forwardPE  : null
        chartMap[q.symbol].sector        = q.sector    ?? null
        chartMap[q.symbol].industry      = q.industry  ?? null
        chartMap[q.symbol].analystRating = q.recommendationKey ?? null
        chartMap[q.symbol].analystCount  = q.numberOfAnalystOpinions ?? null
        chartMap[q.symbol].targetPrice   = q.targetMeanPrice ?? null
        chartMap[q.symbol].eps           = q.epsTrailingTwelveMonths ?? null
        chartMap[q.symbol].epsForward    = q.epsForward ?? null
        chartMap[q.symbol].divYield      = q.dividendYield ?? null
        if (q.shortName && !chartMap[q.symbol].name) chartMap[q.symbol].name = q.shortName
      })
      break // success
    } catch(e) {
      console.log(`v7 ${host} failed:`, e.message)
    }
  }

  return res.status(200).json(Object.values(chartMap))
}
