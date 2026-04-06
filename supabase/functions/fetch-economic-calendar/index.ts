const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalendarEvent {
  time: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  event: string
  forecast: string
  previous: string
  actual: string
}

function parseCalendarHTML(html: string): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // Parse rows from the economic calendar HTML table
  const rowRegex = /<tr[^>]*class="[^"]*js-event-item[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi
  let match: RegExpExecArray | null

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1]

    // Extract time
    const timeMatch = row.match(/<td[^>]*class="[^"]*time[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const time = timeMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || ''

    // Extract currency
    const curMatch = row.match(/<td[^>]*class="[^"]*flagCur[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const currency = curMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || ''

    // Extract impact (count bull icons)
    const impactMatch = row.match(/<td[^>]*class="[^"]*sentiment[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const impactHtml = impactMatch?.[1] || ''
    const bullCount = (impactHtml.match(/grayFullBullishIcon/gi) || []).length
    const impact: 'high' | 'medium' | 'low' = bullCount >= 3 ? 'high' : bullCount === 2 ? 'medium' : 'low'

    // Extract event name
    const eventMatch = row.match(/<td[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const event = eventMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || ''

    // Extract actual, forecast, previous
    const actualMatch = row.match(/<td[^>]*class="[^"]*act[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const actual = actualMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '—'

    const forecastMatch = row.match(/<td[^>]*class="[^"]*fore[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const forecast = forecastMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '—'

    const previousMatch = row.match(/<td[^>]*class="[^"]*prev[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const previous = previousMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '—'

    if (event) {
      events.push({
        time: time || '—',
        currency: currency.slice(0, 3).toUpperCase(),
        impact,
        event: event.slice(0, 80),
        forecast: forecast || '—',
        previous: previous || '—',
        actual: actual || '—',
      })
    }
  }

  return events
}

// Fallback: Parse RSS feed from Investing.com
function parseCalendarRSS(xml: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] ||
                  itemXml.match(/<title>(.*?)<\/title>/)?.[1] || ''
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''

    if (title.trim()) {
      // Try to parse currency from title (first 3 chars often)
      const curMatch = title.match(/^\(([A-Z]{2,3})\)/)
      const currency = curMatch?.[1] || '—'

      const time = pubDate ? new Date(pubDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

      events.push({
        time,
        currency,
        impact: 'medium',
        event: title.replace(/^\([A-Z]{2,3}\)\s*/, '').slice(0, 80),
        forecast: '—',
        previous: '—',
        actual: '—',
      })
    }
  }
  return events
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let events: CalendarEvent[] = []

    // Try Investing.com economic calendar page
    try {
      const res = await fetch('https://www.investing.com/economic-calendar/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const html = await res.text()
        events = parseCalendarHTML(html)
      }
    } catch (e) {
      console.warn('Failed to fetch Investing.com calendar page:', e)
    }

    // Fallback: Try RSS
    if (events.length === 0) {
      try {
        const res = await fetch('https://www.investing.com/rss/economic_calendar.rss', {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const xml = await res.text()
          events = parseCalendarRSS(xml)
        }
      } catch (e) {
        console.warn('Failed to fetch calendar RSS:', e)
      }
    }

    // Fallback: Use ForexFactory-style or generate from current date
    if (events.length === 0) {
      // Use a third source: Trading Economics calendar
      try {
        const res = await fetch('https://tradingeconomics.com/calendar', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const html = await res.text()
          // Parse table rows
          const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
          let trMatch: RegExpExecArray | null
          while ((trMatch = trRegex.exec(html)) !== null) {
            const tds = trMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
            if (tds && tds.length >= 5) {
              const getText = (td: string) => td.replace(/<[^>]*>/g, '').trim()
              const time = getText(tds[0])
              const country = getText(tds[1])
              const event = getText(tds[2])
              const actual = tds[3] ? getText(tds[3]) : '—'
              const previous = tds[4] ? getText(tds[4]) : '—'
              const forecast = tds[5] ? getText(tds[5]) : '—'

              if (event && time.match(/\d{1,2}:\d{2}/)) {
                // Map country to currency
                const countryToCur: Record<string, string> = {
                  'United States': 'USD', 'Euro Area': 'EUR', 'United Kingdom': 'GBP',
                  'Japan': 'JPY', 'Canada': 'CAD', 'Australia': 'AUD',
                  'New Zealand': 'NZD', 'Switzerland': 'CHF', 'China': 'CNY',
                  'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR',
                }
                events.push({
                  time,
                  currency: countryToCur[country] || country.slice(0, 3).toUpperCase(),
                  impact: 'medium',
                  event: event.slice(0, 80),
                  forecast: forecast || '—',
                  previous: previous || '—',
                  actual: actual || '—',
                })
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Trading Economics calendar:', e)
      }
    }

    // Limit to 30 events
    const limited = events.slice(0, 30)

    return new Response(JSON.stringify({ success: true, data: limited }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Calendar fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch calendar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
