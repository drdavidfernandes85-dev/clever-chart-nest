const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD',
  'NZD/USD', 'USD/CAD', 'USD/CHF', 'EUR/GBP',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('TWELVE_DATA_API_KEY')
    let tickers: any[] = []
    let usedTwelveData = false

    if (apiKey) {
      try {
        // Try individual requests to Twelve Data
        const first = await fetch(
          `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(SYMBOLS[0])}&apikey=${apiKey}`
        )
        const firstData = await first.json()
        console.log('Twelve Data test response:', JSON.stringify(firstData))

        if (firstData.close && !firstData.status) {
          // It works — fetch all pairs
          const results = await Promise.allSettled(
            SYMBOLS.slice(1).map(async (pair) => {
              const res = await fetch(
                `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(pair)}&apikey=${apiKey}`
              )
              return { pair, data: await res.json() }
            })
          )

          const allQuotes = [
            { pair: SYMBOLS[0], data: firstData },
            ...results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value),
          ]

          tickers = allQuotes.map(({ pair, data: quote }) => {
            const price = parseFloat(quote.close || '0')
            const prevClose = parseFloat(quote.previous_close || '0')
            const changeVal = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
            const decimals = pair.includes('JPY') ? 3 : 5

            return {
              pair,
              price: price > 0 ? price.toFixed(decimals) : '--',
              change: changeVal >= 0 ? `+${changeVal.toFixed(2)}%` : `${changeVal.toFixed(2)}%`,
              bias: changeVal > 0.05 ? 'bullish' : changeVal < -0.05 ? 'bearish' : 'neutral',
              strength: Math.min(100, Math.max(0, 50 + changeVal * 10)),
              timestamp: new Date().toISOString(),
            }
          })
          usedTwelveData = true
        }
      } catch (e) {
        console.error('Twelve Data failed, falling back:', e)
      }
    }

    if (!usedTwelveData) {
      // Frankfurter API fallback
      const bases = [...new Set(SYMBOLS.map(p => p.split('/')[0]))]
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (yesterday.getDay() === 0) yesterday.setDate(yesterday.getDate() - 2)
      if (yesterday.getDay() === 6) yesterday.setDate(yesterday.getDate() - 1)
      const prevDate = yesterday.toISOString().split('T')[0]

      const [latestResults, prevResults] = await Promise.all([
        Promise.all(bases.map(async (base) => {
          const tos = SYMBOLS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
          const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${tos.join(',')}`)
          return { base, rates: (await res.json()).rates ?? {} }
        })),
        Promise.all(bases.map(async (base) => {
          const tos = SYMBOLS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
          const res = await fetch(`https://api.frankfurter.dev/v1/${prevDate}?base=${base}&symbols=${tos.join(',')}`)
          return { base, rates: (await res.json()).rates ?? {} }
        })),
      ])

      const latestMap: Record<string, Record<string, number>> = {}
      const prevMap: Record<string, Record<string, number>> = {}
      for (const r of latestResults) latestMap[r.base] = r.rates
      for (const r of prevResults) prevMap[r.base] = r.rates

      tickers = SYMBOLS.map((pair) => {
        const [from, to] = pair.split('/')
        const price = latestMap[from]?.[to] ?? null
        const prevPrice = prevMap[from]?.[to] ?? null
        const changeValue = price && prevPrice ? ((price - prevPrice) / prevPrice) * 100 : 0
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
    }

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
