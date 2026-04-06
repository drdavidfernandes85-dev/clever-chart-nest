import { corsHeaders } from '@supabase/supabase-js/cors'

const RSS_FEEDS = [
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^DJI,^GSPC,^IXIC&region=US&lang=en-US', source: 'Yahoo Finance', category: 'MARKETS' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', category: 'TOP NEWS' },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC', category: 'FOREX' },
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=CL=F,GC=F&region=US&lang=en-US', source: 'Yahoo Finance', category: 'COMMODITIES' },
  { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com', category: 'MARKETS' },
]

interface NewsItem {
  title: string
  link: string
  pubDate: string
  source: string
  category: string
  description?: string
}

function parseXML(xml: string, source: string, category: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || itemXml.match(/<title>(.*?)<\/title>/)?.[1] || ''
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || ''
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
    const desc = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/)?.[1] ||
                 itemXml.match(/<description>(.*?)<\/description>/)?.[1] || ''

    if (title.trim()) {
      items.push({
        title: title.replace(/<[^>]*>/g, '').trim(),
        link: link.trim(),
        pubDate,
        source,
        category,
        description: desc.replace(/<[^>]*>/g, '').trim().slice(0, 200) || undefined,
      })
    }
  }
  return items
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const allItems: NewsItem[] = []

    const results = await Promise.allSettled(
      RSS_FEEDS.map(async (feed) => {
        try {
          const res = await fetch(feed.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
            signal: AbortSignal.timeout(5000),
          })
          if (!res.ok) return []
          const xml = await res.text()
          return parseXML(xml, feed.source, feed.category)
        } catch {
          console.warn(`Failed to fetch ${feed.source}: ${feed.url}`)
          return []
        }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        allItems.push(...result.value)
      }
    }

    // Sort by date descending
    allItems.sort((a, b) => {
      const da = new Date(a.pubDate).getTime() || 0
      const db = new Date(b.pubDate).getTime() || 0
      return db - da
    })

    // Limit to 50 most recent
    const limited = allItems.slice(0, 50)

    return new Response(JSON.stringify({ success: true, data: limited }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('RSS fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch news' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
