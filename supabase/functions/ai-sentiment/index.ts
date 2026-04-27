// Computes 0-100 market sentiment score from news + active signals
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

const SENTIMENT_LABELS: Record<string, Record<string, string>> = {
  en: { extreme_fear: "Extreme Fear", fear: "Fear", neutral: "Neutral", greed: "Greed", extreme_greed: "Extreme Greed" },
  es: { extreme_fear: "Miedo Extremo", fear: "Miedo", neutral: "Neutral", greed: "Codicia", extreme_greed: "Codicia Extrema" },
  pt: { extreme_fear: "Medo Extremo", fear: "Medo", neutral: "Neutro", greed: "Ganância", extreme_greed: "Ganância Extrema" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let locale = "en";
  try {
    if (req.method === "POST") {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.locale && LANG_NAME[body.locale]) locale = body.locale;
    }
  } catch { /* ignore */ }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = supabaseUrl.split("//")[1].split(".")[0];
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const [newsRes, signalsRes] = await Promise.allSettled([
      fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-rss-news`, {
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
      }).then((r) => r.json()),
      supabase
        .from("trading_signals")
        .select("pair, direction, status")
        .eq("status", "active")
        .limit(20),
    ]);

    const newsRaw = newsRes.status === "fulfilled" ? newsRes.value?.data || newsRes.value?.news || newsRes.value || [] : [];
    const news = Array.isArray(newsRaw) ? newsRaw.slice(0, 15) : [];
    const signals: any[] = signalsRes.status === "fulfilled" ? signalsRes.value.data || [] : [];

    const longs = signals.filter((s) => s.direction === "long").length;
    const shorts = signals.filter((s) => s.direction === "short").length;

    const newsBlock = news.map((n: any) => `- ${n.title}`).join("\n") || "No news.";

    const tools = [
      {
        type: "function",
        function: {
          name: "report_sentiment",
          description: "Return market sentiment score and reasoning.",
          parameters: {
            type: "object",
            properties: {
              score: { type: "number", description: "0=extreme fear, 50=neutral, 100=extreme greed" },
              label: {
                type: "string",
                enum: ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"],
              },
              reasoning: { type: "string", description: "1-2 sentence explanation, max 150 chars" },
            },
            required: ["score", "label", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You analyze financial markets. Score sentiment 0-100 (Fear & Greed style) based on news tone and signal direction balance.",
          },
          {
            role: "user",
            content: `## Recent news\n${newsBlock}\n\n## Active signals\nLongs: ${longs}, Shorts: ${shorts}\n\nReturn a sentiment score.`,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "report_sentiment" } },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!args) {
      return new Response(JSON.stringify({ score: 50, label: "Neutral", reasoning: "Insufficient data." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        score: Math.max(0, Math.min(100, args.score)),
        label: args.label,
        reasoning: args.reasoning,
        meta: { longs, shorts, newsCount: news.length },
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-sentiment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
