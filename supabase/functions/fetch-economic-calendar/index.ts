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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let events: CalendarEvent[] = []

    // Try DailyFX economic calendar JSON endpoint
    try {
      const today = new Date()
      const startDate = today.toISOString().split('T')[0]
      const endDate = new Date(today.getTime() + 86400000).toISOString().split('T')[0]
      
      const url = `https://nfs.faireconomy.media/ff_calendar_thisweek.json`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CalBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          for (const item of data) {
            // Filter to today and tomorrow only
            const eventDate = item.date ? new Date(item.date) : null
            if (!eventDate) continue
            
            const diffDays = Math.abs(eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            if (diffDays > 2) continue

            const time = eventDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' 
            })
            
            const impactMap: Record<string, 'high' | 'medium' | 'low'> = {
              'High': 'high',
              'Medium': 'medium', 
              'Low': 'low',
              'Holiday': 'low',
            }

            events.push({
              time,
              currency: (item.country || '').toUpperCase().slice(0, 3),
              impact: impactMap[item.impact] || 'medium',
              event: (item.title || '').slice(0, 80),
              forecast: item.forecast || '—',
              previous: item.previous || '—',
              actual: item.actual || '—',
            })
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch FF calendar:', e)
    }

    // Fallback: try Forex Factory-style endpoint
    if (events.length === 0) {
      try {
        const res = await fetch('https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            const today = new Date()
            for (const item of data) {
              const eventDate = item.date ? new Date(item.date) : null
              if (!eventDate) continue
              const diffDays = Math.abs(eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              if (diffDays > 2) continue

              const time = eventDate.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York'
              })
              const impactMap: Record<string, 'high' | 'medium' | 'low'> = {
                'High': 'high', 'Medium': 'medium', 'Low': 'low', 'Holiday': 'low',
              }
              events.push({
                time,
                currency: (item.country || '').toUpperCase().slice(0, 3),
                impact: impactMap[item.impact] || 'medium',
                event: (item.title || '').slice(0, 80),
                forecast: item.forecast || '—',
                previous: item.previous || '—',
                actual: item.actual || '—',
              })
            }
          }
        }
      } catch (e) {
        console.warn('Fallback calendar failed:', e)
      }
    }

    // Sort by time
    events.sort((a, b) => a.time.localeCompare(b.time))
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
