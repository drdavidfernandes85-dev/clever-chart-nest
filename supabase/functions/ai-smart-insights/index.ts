// AI Smart Insights — synthesizes news + economic calendar into 3 sections:
// market_summary, key_opportunities, risk_alerts (structured JSON)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = supabaseUrl.split("//")[1].split(".")[0];
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const [newsRes, calRes] = await Promise.allSettled([
      fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-rss-news`, {
        headers: { Authorization: `Bearer ${anon}` },
      }).then((r) => r.json()),
      fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-economic-calendar`, {
        headers: { Authorization: `Bearer ${anon}` },
      }).then((r) => r.json()),
    ]);

    const news = (() => {
      const v = newsRes.status === "fulfilled" ? newsRes.value?.data || newsRes.value?.news || newsRes.value || [] : [];
      return Array.isArray(v) ? v.slice(0, 14) : [];
    })();
    const calendar = (() => {
      const v = calRes.status === "fulfilled" ? calRes.value?.data || calRes.value?.events || calRes.value || [] : [];
      return Array.isArray(v) ? v.slice(0, 10) : [];
    })();

    const newsBlock =
      news.map((n: any) => `- [${n.category || n.source || "NEWS"}] ${n.title}`).join("\n") || "No headlines.";
    const calBlock =
      calendar
        .map((e: any) => `- ${e.time || e.date || ""} ${e.country || e.currency || ""} ${e.event || e.name || ""} (${e.impact || "n/a"})`)
        .join("\n") || "No events.";

    const tools = [
      {
        type: "function",
        function: {
          name: "render_insights",
          description: "Return structured market insights for traders.",
          parameters: {
            type: "object",
            properties: {
              market_summary: { type: "string", description: "1-2 sentence overview of macro tape and risk tone." },
              key_opportunities: {
                type: "array",
                description: "2-4 concrete opportunities a discretionary trader should watch today.",
                items: {
                  type: "object",
                  properties: {
                    pair: { type: "string" },
                    bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
                    rationale: { type: "string" },
                  },
                  required: ["pair", "bias", "rationale"],
                  additionalProperties: false,
                },
              },
              risk_alerts: {
                type: "array",
                description: "1-3 risk alerts: events, volatility spikes, or correlated risks.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["title", "detail", "severity"],
                  additionalProperties: false,
                },
              },
            },
            required: ["market_summary", "key_opportunities", "risk_alerts"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an institutional macro strategist. You read live news + calendar and return tight, actionable insights for active FX/metals traders. Never give financial advice; speak in probabilistic terms.",
          },
          {
            role: "user",
            content: `Generate today's smart insights.\n\n## NEWS\n${newsBlock}\n\n## CALENDAR\n${calBlock}`,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "render_insights" } },
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
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    if (!parsed) throw new Error("No structured response");

    return new Response(
      JSON.stringify({ ...parsed, generatedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-smart-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
