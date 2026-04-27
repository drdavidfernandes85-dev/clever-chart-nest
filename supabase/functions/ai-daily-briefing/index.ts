// Generates a daily market briefing using news + calendar context
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish (Español)",
  pt: "Brazilian Portuguese (Português do Brasil)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Parse optional locale from POST body or query string
  let locale = "en";
  try {
    if (req.method === "POST") {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.locale && LANG_NAME[body.locale]) locale = body.locale;
    } else {
      const url = new URL(req.url);
      const q = url.searchParams.get("locale");
      if (q && LANG_NAME[q]) locale = q;
    }
  } catch { /* ignore */ }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = supabaseUrl.split("//")[1].split(".")[0];

    const [newsRes, calRes] = await Promise.allSettled([
      fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-rss-news`, {
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
      }).then((r) => r.json()),
      fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-economic-calendar`, {
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
      }).then((r) => r.json()),
    ]);

    const newsRaw = newsRes.status === "fulfilled" ? newsRes.value?.data || newsRes.value?.news || newsRes.value || [] : [];
    const calRaw = calRes.status === "fulfilled" ? calRes.value?.data || calRes.value?.events || calRes.value || [] : [];
    const news = Array.isArray(newsRaw) ? newsRaw.slice(0, 12) : [];
    const calendar = Array.isArray(calRaw) ? calRaw.slice(0, 8) : [];

    const newsBlock = news
      .map((n: any) => `- [${n.category || n.source || "NEWS"}] ${n.title}`)
      .join("\n") || "No news.";
    const calBlock = calendar
      .map((e: any) => `- ${e.time || e.date || ""} ${e.country || e.currency || ""} ${e.event || e.name || ""} (${e.impact || "n/a"})`)
      .join("\n") || "No events.";

    const prompt = `Write a punchy morning trading briefing (max 120 words) in markdown.

Structure:
**Overnight:** 1 sentence on the macro tape.
**Watch today:** bullet list of 2-3 events or themes.
**Setups in focus:** 1 sentence on what's actionable.

Tone: professional, confident, no fluff. No financial advice.

IMPORTANT: Write the entire briefing in ${LANG_NAME[locale]}. Keep ticker symbols (EUR/USD, XAU/USD, NAS100, etc.) in their original form.

## News
${newsBlock}

## Calendar
${calBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `You are a senior market strategist for elite traders. You always write in ${LANG_NAME[locale]}.` },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      throw new Error(`Gateway ${response.status}`);
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content || "Briefing unavailable.";

    return new Response(JSON.stringify({ briefing, generatedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-daily-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
