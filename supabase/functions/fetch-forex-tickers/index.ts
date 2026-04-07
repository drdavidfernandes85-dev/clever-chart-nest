const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD',
  'NZD/USD', 'USD/CAD', 'USD/CHF', 'EUR/GBP',
]

// ── Twelve Data (real-time) ──────────────────────────────────────────
async function fetchFromTwelveData(apiKey: string) {
  const symbolList = SYMBOLS.map(s => s.replace('/', '')).join(',')
  const url = `https://api.twelvedata.com/quote?symbol=${symbolList}&apikey=${apiKey}`
  const res = await fetch(url)
  const json = await res.json()

  if (json.code === 401 || json.status === 'error') {
    throw new Error(`Twelve Data error: ${json.message ?? 'unauthorized'}`)
  }

  // Single symbol returns object, multiple returns keyed object
  const entries = Array.isArray(json) ? json : Object.values(json)

  return (entries as any[]).map((q: any) => {
    const pair = q.symbol?.replace(/(\w{3})(\w{3})/, '$1/$2') ?? q.name
    const price = parseFloat(q.close)
    const prevClose = parseFloat(q.previous_close)
    const changeValue = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    const decimals = pair.includes('JPY') ? 3 : 5

    return {
      pair,
      price: isNaN(price) ? '--' : price.toFixed(decimals),
      change: changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`,
      bias: changeValue > 0.05 ? 'bullish' as const : changeValue < -0.05 ? 'bearish' as const : 'neutral' as const,
      strength: Math.min(100, Math.max(0, 50 + changeValue * 10)),
      timestamp: new Date().toISOString(),
    }
  })
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
  const bases = [...new Set(SYMBOLS.map(p => p.split('/')[0]))]
  const today = new Date()
  const [day1, day2, day3] = getBusinessDaysBefore(today, 3)

  // Fetch latest + 3 previous business days in parallel
  const fetchRates = async (dateOrLatest: string) => {
    const endpoint = dateOrLatest === 'latest' ? 'latest' : dateOrLatest
    return Promise.all(bases.map(async (base) => {
      const tos = SYMBOLS.filter(p => p.startsWith(base + '/')).map(p => p.split('/')[1])
      const res = await fetch(`https://api.frankfurter.dev/v1/${endpoint}?base=${base}&symbols=${tos.join(',')}`)
      const json = await res.json()
      return { base, rates: json.rates ?? {}, date: json.date }
    }))
  }

  const [latestResults, d1Results, d2Results, d3Results] = await Promise.all([
    fetchRates('latest'),
    fetchRates(day1),
    fetchRates(day2),
    fetchRates(day3),
  ])

  const toMap = (results: typeof latestResults) => {
    const m: Record<string, Record<string, number>> = {}
    for (const r of results) m[r.base] = r.rates
    return m
  }

  const latestMap = toMap(latestResults)
  const maps = [toMap(d1Results), toMap(d2Results), toMap(d3Results)]
  const latestDate = latestResults[0]?.date

  return SYMBOLS.map((pair) => {
    const [from, to] = pair.split('/')
    const price = latestMap[from]?.[to] ?? null

    // Find the most recent DIFFERENT price for comparison
    let comparePrice: number | null = null
    for (const m of maps) {
      const p = m[from]?.[to]
      if (p != null && price != null && Math.abs(p - price) > 0.000001) {
        comparePrice = p
        break
      }
    }
    // If all days have same price, use the oldest available
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
