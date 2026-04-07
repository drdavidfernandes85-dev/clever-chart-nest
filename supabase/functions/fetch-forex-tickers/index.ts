const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD',
  'NZD/USD', 'USD/CAD', 'USD/CHF', 'EUR/GBP',
]

// ── Twelve Data (real-time, single API call = 1 credit per symbol) ───
async function fetchFromTwelveData(apiKey: string) {
  // Use comma-separated symbols in ONE call (costs 8 credits for 8 symbols)
  const symbolList = PAIRS.map(s => s.replace('/', '')).join(',')
  const url = `https://api.twelvedata.com/quote?symbol=${symbolList}&apikey=${apiKey}`
  const res = await fetch(url)
  const json = await res.json()
  console.log('Twelve Data raw response (first entry):', JSON.stringify(Object.values(json)[0]))

  // Check for API-level errors (single error object or rate limit)
  if (json.code && json.status === 'error') {
    throw new Error(json.message ?? 'Twelve Data API error')
  }

  // When rate-limited on batch, some entries may be error objects
  if (typeof json !== 'object' || !json) {
    throw new Error('Invalid Twelve Data response')
  }

  // Multiple symbols → keyed object { EURUSD: {...}, GBPUSD: {...} }
  const entries = Object.values(json) as any[]

  return entries.map((q: any) => {
    if (!q || !q.symbol) return null

    // Convert "EURUSD" → "EUR/USD"
    const sym = q.symbol as string
    const pair = sym.length === 6 ? `${sym.slice(0, 3)}/${sym.slice(3)}` : sym
    const price = parseFloat(q.close)
    const prevClose = parseFloat(q.previous_close)
    const changeValue = prevClose && !isNaN(prevClose) ? ((price - prevClose) / prevClose) * 100 : 0
    const decimals = pair.includes('JPY') ? 3 : 5

    return {
      pair,
      price: isNaN(price) ? '--' : price.toFixed(decimals),
      change: changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`,
      bias: changeValue > 0.05 ? 'bullish' as const : changeValue < -0.05 ? 'bearish' as const : 'neutral' as const,
      strength: Math.min(100, Math.max(0, 50 + changeValue * 10)),
      timestamp: new Date().toISOString(),
    }
  }).filter(Boolean)
}

// ── Frankfurter (daily fallback) ─────────────────────────────────────
function getBusinessDaysBefore(date: Date, count: number): string[] {
  const days: string[] = []
  const d = new Date(date)
  while (days.length < count) {
    d.setDate(d.getDate() - 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().split('T')[0])
    }
  }
  return days
}

async function fetchFromFrankfurter() {
  const bases = [...new Set(PAIRS.map(p => p.split('/')[0]))]
  const [day1, day2, day3] = getBusinessDaysBefore(new Date(), 3)

  const fetchRates = async (endpoint: string) =>
    Promise.all(bases.map(async (base) => {
      const tos = PAIRS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
      const res = await fetch(`https://api.frankfurter.dev/v1/${endpoint}?base=${base}&symbols=${tos.join(',')}`)
      return { base, rates: (await res.json()).rates ?? {} }
    }))

  const [latestR, d1R, d2R, d3R] = await Promise.all([
    fetchRates('latest'), fetchRates(day1), fetchRates(day2), fetchRates(day3),
  ])

  const toMap = (r: typeof latestR) => {
    const m: Record<string, Record<string, number>> = {}
    for (const x of r) m[x.base] = x.rates
    return m
  }
  const latestMap = toMap(latestR)
  const maps = [toMap(d1R), toMap(d2R), toMap(d3R)]

  return PAIRS.map((pair) => {
    const [from, to] = pair.split('/')
    const price = latestMap[from]?.[to] ?? null
    let comparePrice: number | null = null
    for (const m of maps) {
      const p = m[from]?.[to]
      if (p != null && price != null && Math.abs(p - price) > 0.000001) { comparePrice = p; break }
    }
    if (comparePrice === null) {
      for (const m of [...maps].reverse()) {
        const p = m[from]?.[to]
        if (p != null) { comparePrice = p; break }
      }
    }
    const changeValue = price && comparePrice ? ((price - comparePrice) / comparePrice) * 100 : 0
    const decimals = pair.includes('JPY') ? 3 : 5
    return {
      pair,
      price: price !== null ? price.toFixed(decimals) : '--',
      change: changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`,
      bias: changeValue > 0.05 ? 'bullish' as const : changeValue < -0.05 ? 'bearish' as const : 'neutral' as const,
      strength: Math.min(100, Math.max(0, 50 + changeValue * 10)),
      timestamp: new Date().toISOString(),
    }
  })
}

// ── Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let tickers: any[]
    const apiKey = Deno.env.get('TWELVE_DATA_API_KEY')

    if (apiKey) {
      try {
        tickers = await fetchFromTwelveData(apiKey)
        console.log('Using Twelve Data (real-time)')
      } catch (e) {
        console.warn('Twelve Data failed, falling back to Frankfurter:', (e as Error).message)
        tickers = await fetchFromFrankfurter()
      }
    } else {
      tickers = await fetchFromFrankfurter()
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
