// Fetch Yahoo Finance RSS news for a symbol and return parsed items
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols required' })

  // Use Yahoo Finance search API to get news
  const syms = symbols.split(',').slice(0, 5) // max 5 symbols
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }

  // Fetch news for each symbol and merge
  const allNews = []
  await Promise.all(syms.map(async sym => {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${sym.trim()}&newsCount=4&quotesCount=0&enableFuzzyQuery=false`
      let r = await fetch(url, { headers })
      if (!r.ok) r = await fetch(url.replace('query1','query2'), { headers })
      const data = await r.json()
      const items = data?.news ?? []
      items.forEach(item => {
        allNews.push({
          title:     item.title,
          url:       item.link,
          publisher: item.publisher,
          time:      item.providerPublishTime,
          sym:       sym.trim().toUpperCase(),
        })
      })
    } catch {}
  }))

  // Deduplicate by title and sort by time descending
  const seen = new Set()
  const deduped = allNews
    .filter(n => { if (seen.has(n.title)) return false; seen.add(n.title); return true })
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
    .slice(0, 12)

  return res.status(200).json(deduped)
}
