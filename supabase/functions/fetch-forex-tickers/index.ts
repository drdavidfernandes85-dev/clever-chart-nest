const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const tickerResults = await Promise.all(
      PAIRS.map(async (pair) => {
        const quoteRes = await fetch(
          `${TWELVE_DATA_URL}/quote?symbol=${encodeURIComponent(pair)}&apikey=${apiKey}`
        )
        const quoteData = await quoteRes.json()

        if (!quoteRes.ok || quoteData?.status === 'error') {
          console.error('Quote fetch failed for pair:', pair, JSON.stringify(quoteData))
          return {
            pair,
            price: '--',
            change: '+0.00%',
            bias: 'neutral',
            strength: 50,
            timestamp: null,
          }
        }

        const priceRaw = quoteData.close ?? quoteData.previous_close ?? quoteData.price ?? null
        const priceValue = priceRaw ? parseFloat(priceRaw) : null
        const changeValue = quoteData.percent_change ? parseFloat(quoteData.percent_change) : 0
        const decimals = pair.includes('JPY') ? 3 : 4

        return {
          pair,
          price: priceValue !== null && Number.isFinite(priceValue) ? priceValue.toFixed(decimals) : '--',
          change: changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`,
          bias: changeValue > 0.05 ? 'bullish' : changeValue < -0.05 ? 'bearish' : 'neutral',
          strength: Math.min(100, Math.max(0, 50 + changeValue * 10)),
          timestamp: quoteData.datetime ?? null,
        }
      })
    )

    return new Response(JSON.stringify({ tickers: tickerResults, fetchedAt: new Date().toISOString() }), {
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