// Vercel serverless function for CNN Fear & Greed Index
// Called by the frontend as /api/feargreed

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  try {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.cnn.com/',
      },
    })

    if (!r.ok) return res.status(502).json({ error: `CNN returned ${r.status}` })

    const data = await r.json()
    const val = Math.round(data?.fear_and_greed?.score ?? data?.score ?? 50)
    const rating = data?.fear_and_greed?.rating ?? scoreToLabel(val)
    return res.status(200).json({ val, rating })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

function scoreToLabel(val) {
  if (val <= 25) return 'Extreme Fear'
  if (val <= 45) return 'Fear'
  if (val <= 55) return 'Neutral'
  if (val <= 75) return 'Greed'
  return 'Extreme Greed'
}
