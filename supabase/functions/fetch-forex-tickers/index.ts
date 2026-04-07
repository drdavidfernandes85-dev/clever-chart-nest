const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAIRS = [
  { pair: 'EUR/USD', from: 'EUR', to: 'USD' },
  { pair: 'GBP/USD', from: 'GBP', to: 'USD' },
  { pair: 'USD/JPY', from: 'USD', to: 'JPY' },
  { pair: 'AUD/USD', from: 'AUD', to: 'USD' },
  { pair: 'NZD/USD', from: 'NZD', to: 'USD' },
  { pair: 'USD/CAD', from: 'USD', to: 'CAD' },
  { pair: 'USD/CHF', from: 'USD', to: 'CHF' },
  { pair: 'EUR/GBP', from: 'EUR', to: 'GBP' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fetch latest rates and previous day rates from Frankfurter (free, no key)
    const bases = [...new Set(PAIRS.map(p => p.from))]
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    // Skip weekends for previous trading day
    if (yesterday.getDay() === 0) yesterday.setDate(yesterday.getDate() - 2)
    if (yesterday.getDay() === 6) yesterday.setDate(yesterday.getDate() - 1)
    const prevDate = yesterday.toISOString().split('T')[0]

    const allTos = [...new Set(PAIRS.map(p => p.to))]

    const [latestResults, prevResults] = await Promise.all([
      Promise.all(bases.map(async (base) => {
        const tos = PAIRS.filter(p => p.from === base).map(p => p.to)
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${tos.join(',')}`)
        const data = await res.json()
        return { base, rates: data.rates ?? {} }
      })),
      Promise.all(bases.map(async (base) => {
        const tos = PAIRS.filter(p => p.from === base).map(p => p.to)
        const res = await fetch(`https://api.frankfurter.dev/v1/${prevDate}?base=${base}&symbols=${tos.join(',')}`)
        const data = await res.json()
        return { base, rates: data.rates ?? {} }
      })),
    ])

    const latestMap: Record<string, Record<string, number>> = {}
    const prevMap: Record<string, Record<string, number>> = {}
    for (const r of latestResults) latestMap[r.base] = r.rates
    for (const r of prevResults) prevMap[r.base] = r.rates

    const tickers = PAIRS.map(({ pair, from, to }) => {
      const price = latestMap[from]?.[to] ?? null
      const prevPrice = prevMap[from]?.[to] ?? null
      const changeValue = price && prevPrice ? ((price - prevPrice) / prevPrice) * 100 : 0
      const decimals = pair.includes('JPY') ? 3 : 4

      return {
        pair,
        price: price !== null ? price.toFixed(decimals) : '--',
        change: changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`,
        bias: changeValue > 0.05 ? 'bullish' as const : changeValue < -0.05 ? 'bearish' as const : 'neutral' as const,
        strength: Math.min(100, Math.max(0, 50 + changeValue * 10)),
        timestamp: new Date().toISOString(),
      }
    })

    return new Response(JSON.stringify({ tickers, fetchedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Forex fetch error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
