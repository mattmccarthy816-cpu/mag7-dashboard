// Fetch earnings dates for a list of symbols via Yahoo Finance
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols required' })

  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }

  const results = await Promise.all(syms.map(async sym => {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=calendarEvents,defaultKeyStatistics`
      let r = await fetch(url, { headers })
      if (!r.ok) r = await fetch(url.replace('query1', 'query2'), { headers })
      const data = await r.json()
      const cal = data?.quoteSummary?.result?.[0]?.calendarEvents
      const earnings = cal?.earnings
      const dates = earnings?.earningsDate ?? []
      const nextDate = dates.length ? dates[0]?.raw : null
      const stats = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics
      const week52High = stats?.['52WeekHigh']?.raw ?? null
      const week52Low  = stats?.['52WeekLow']?.raw  ?? null
      return { sym, nextEarnings: nextDate, week52High, week52Low }
    } catch (e) {
      return { sym, error: e.message }
    }
  }))

  return res.status(200).json(results)
}
