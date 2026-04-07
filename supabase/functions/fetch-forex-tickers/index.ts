const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD',
  'NZD/USD', 'USD/CAD', 'USD/CHF', 'EUR/GBP',
]

function getPreviousBusinessDay(date: Date): string {
  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  // Skip weekends
  while (prev.getDay() === 0 || prev.getDay() === 6) {
    prev.setDate(prev.getDate() - 1)
  }
  return prev.toISOString().split('T')[0]
}

function getTwoPreviousBusinessDays(date: Date): [string, string] {
  const d1 = new Date(date)
  // Go to previous business day
  d1.setDate(d1.getDate() - 1)
  while (d1.getDay() === 0 || d1.getDay() === 6) d1.setDate(d1.getDate() - 1)

  const d2 = new Date(d1)
  d2.setDate(d2.getDate() - 1)
  while (d2.getDay() === 0 || d2.getDay() === 6) d2.setDate(d2.getDate() - 1)

  return [d1.toISOString().split('T')[0], d2.toISOString().split('T')[0]]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bases = [...new Set(SYMBOLS.map(p => p.split('/')[0]))]
    const today = new Date()

    // Get latest rates + two previous business days to ensure we get a change
    const [prevDay1, prevDay2] = getTwoPreviousBusinessDays(today)

    const [latestResults, prev1Results, prev2Results] = await Promise.all([
      Promise.all(bases.map(async (base) => {
        const tos = SYMBOLS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${tos.join(',')}`)
        return { base, rates: (await res.json()).rates ?? {} }
      })),
      Promise.all(bases.map(async (base) => {
        const tos = SYMBOLS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
        const res = await fetch(`https://api.frankfurter.dev/v1/${prevDay1}?base=${base}&symbols=${tos.join(',')}`)
        return { base, rates: (await res.json()).rates ?? {} }
      })),
      Promise.all(bases.map(async (base) => {
        const tos = SYMBOLS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
        const res = await fetch(`https://api.frankfurter.dev/v1/${prevDay2}?base=${base}&symbols=${tos.join(',')}`)
        return { base, rates: (await res.json()).rates ?? {} }
      })),
    ])

    const latestMap: Record<string, Record<string, number>> = {}
    const prev1Map: Record<string, Record<string, number>> = {}
    const prev2Map: Record<string, Record<string, number>> = {}
    for (const r of latestResults) latestMap[r.base] = r.rates
    for (const r of prev1Results) prev1Map[r.base] = r.rates
    for (const r of prev2Results) prev2Map[r.base] = r.rates

    const tickers = SYMBOLS.map((pair) => {
      const [from, to] = pair.split('/')
      const price = latestMap[from]?.[to] ?? null
      const prevPrice = prev1Map[from]?.[to] ?? prev2Map[from]?.[to] ?? null
      
      // If latest equals prev1 (same day), use prev2 for comparison
      let comparePrice = prevPrice
      if (price !== null && prevPrice !== null && Math.abs(price - prevPrice) < 0.000001) {
        comparePrice = prev2Map[from]?.[to] ?? prevPrice
      }

      const changeValue = price && comparePrice ? ((price - comparePrice) / comparePrice) * 100 : 0
      const decimals = pair.includes('JPY') ? 3 : 4

      return {
        pair,
        price: price !== null ? price.toFixed(decimals) : '--',
        change: changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`,
        bias: changeValue > 0.05 ? 'bullish' : changeValue < -0.05 ? 'bearish' : 'neutral',
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
