import { corsHeaders } from '@supabase/supabase-js/cors'

const TWELVE_DATA_URL = 'https://api.twelvedata.com'
const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD',
  'NZD/USD', 'USD/CAD', 'USD/CHF', 'EUR/GBP'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'TWELVE_DATA_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const symbols = PAIRS.join(',')

    // Fetch current prices
    const priceRes = await fetch(
      `${TWELVE_DATA_URL}/price?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`
    )
    const priceData = await priceRes.json()

    // Fetch quotes for change data
    const quoteRes = await fetch(
      `${TWELVE_DATA_URL}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`
    )
    const quoteData = await quoteRes.json()

    const tickers = PAIRS.map((pair) => {
      const price = priceData[pair]?.price ?? null
      const quote = quoteData[pair] ?? {}
      const change = quote.percent_change ? parseFloat(quote.percent_change) : 0
      const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`

      return {
        pair,
        price: price ? parseFloat(price).toFixed(4) : '--',
        change: changeStr,
        bias: change > 0.05 ? 'bullish' : change < -0.05 ? 'bearish' : 'neutral',
        strength: Math.min(100, Math.max(0, 50 + change * 10)),
        timestamp: quote.datetime ?? null,
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