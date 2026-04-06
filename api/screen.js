// Stock screener — fetches fundamentals using Yahoo v7 quote API
// v7 returns sector, PE, marketCap, analyst rating in one call
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

  const fields = [
    'regularMarketPrice','regularMarketChangePercent',
    'regularMarketVolume','averageVolume',
    'marketCap','trailingPE','forwardPE',
    'priceToBook','shortName','longName','sector','industry',
    'fiftyTwoWeekHigh','fiftyTwoWeekLow',
    'dividendYield','trailingAnnualDividendYield',
    'epsTrailingTwelveMonths','epsForward',
    'recommendationKey','numberOfAnalystOpinions','targetMeanPrice',
    'regularMarketDayHigh','regularMarketDayLow',
  ].join(',')

  // Try v7 with both hosts
  for (const host of ['query1','query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=${fields}&formatted=false`
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
      if (!r.ok) continue
      const data = await r.json()
      const quotes = data?.quoteResponse?.result
      if (!quotes?.length) continue

      const results = quotes.map(q => ({
        sym:            q.symbol,
        name:           q.shortName ?? q.longName ?? q.symbol,
        price:          q.regularMarketPrice ?? null,
        changePercent:  q.regularMarketChangePercent ?? null,
        marketCap:      q.marketCap ?? null,
        trailingPE:     q.trailingPE ?? null,
        forwardPE:      q.forwardPE ?? null,
        priceToBook:    q.priceToBook ?? null,
        eps:            q.epsTrailingTwelveMonths ?? null,
        epsForward:     q.epsForward ?? null,
        sector:         q.sector ?? null,
        industry:       q.industry ?? null,
        week52High:     q.fiftyTwoWeekHigh ?? null,
        week52Low:      q.fiftyTwoWeekLow ?? null,
        divYield:       q.dividendYield ?? q.trailingAnnualDividendYield ?? null,
        volume:         q.regularMarketVolume ?? null,
        avgVolume:      q.averageVolume ?? null,
        // Analyst data
        analystRating:  q.recommendationKey ?? null,    // 'buy','hold','sell','strong_buy' etc
        analystCount:   q.numberOfAnalystOpinions ?? null,
        targetPrice:    q.targetMeanPrice ?? null,
      }))

      return res.status(200).json(results)
    } catch(e) {
      console.log(`${host} v7 failed:`, e.message)
    }
  }

  // Fallback: chart API (no PE/sector but gets price/mcap/change)
  const results = []
  const CONC = 6
  for (let i = 0; i < syms.length; i += CONC) {
    await Promise.all(syms.slice(i, i+CONC).map(async sym => {
      try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`
        const r = await fetch(url, { headers, signal: AbortSignal.timeout(6000) })
        if (!r.ok) return
        const d = await r.json()
        const m = d?.chart?.result?.[0]?.meta
        if (!m) return
        const price = m.regularMarketPrice, prev = m.chartPreviousClose ?? m.previousClose
        results.push({
          sym, name: m.longName ?? m.shortName ?? sym,
          price, changePercent: price&&prev ? (price-prev)/prev*100 : null,
          marketCap: m.marketCap??null, trailingPE:null, forwardPE:null,
          sector:null, industry:null, week52High:m.fiftyTwoWeekHigh??null,
          week52Low:m.fiftyTwoWeekLow??null, analystRating:null,
        })
      } catch {}
    }))
  }
  return res.status(200).json(results)
}
