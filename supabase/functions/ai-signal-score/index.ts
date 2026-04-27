// AI Signal Score — scores a trading signal (0-100) with brief explanation.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  symbol?: string;
  pair?: string;
  direction?: "buy" | "sell" | string;
  entry?: number;
  entry_price?: number;
  sl?: number | null;
  stop_loss?: number | null;
  tp?: number | null;
  take_profit?: number | null;
  author?: string | null;
}

const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish (Español)",
  pt: "Brazilian Portuguese (Português do Brasil)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = (await req.json()) as Body & { locale?: string };
    const locale = body?.locale && LANG_NAME[body.locale] ? body.locale : "en";
    const symbol = String(body?.symbol || body?.pair || "").trim().toUpperCase();
    const direction = String(body?.direction || "").trim().toLowerCase();
    const entry = Number(body?.entry ?? body?.entry_price);
    const sl = body?.sl ?? body?.stop_loss ?? null;
    const tp = body?.tp ?? body?.take_profit ?? null;
    const author = body?.author ? String(body.author).trim().slice(0, 80) : "Community trader";

    if (!symbol || !["buy", "sell"].includes(direction) || !Number.isFinite(entry)) {
      return new Response(JSON.stringify({ error: "symbol, direction, and entry are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull a small slice of fresh headlines for context.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = supabaseUrl.split("//")[1].split(".")[0];
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const newsRes = await fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-rss-news`, {
      headers: { Authorization: `Bearer ${anon}` },
    })
      .then((r) => r.json())
      .catch(() => ({}));
    const news = Array.isArray(newsRes?.data || newsRes?.news || newsRes)
      ? (newsRes.data || newsRes.news || newsRes).slice(0, 8)
      : [];
    const newsBlock = news.map((n: any) => `- ${n.title}`).join("\n") || "No fresh headlines.";

    const tools = [
      {
        type: "function",
        function: {
          name: "score_signal",
          description: "Score a discretionary trading signal 0-100 with a 1-sentence rationale.",
          parameters: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100, description: "Conviction score: 0-100." },
              rating: { type: "string", enum: ["weak", "fair", "good", "strong", "elite"] },
              rationale: {
                type: "string",
                description: "Single concise sentence: why this score, including R:R + macro alignment.",
              },
              risk_reward: { type: "number", description: "Reward divided by risk (positive number)." },
            },
            required: ["score", "rating", "rationale"],
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
              "You are a senior trading desk risk officer. You score signals on technical structure, R:R quality, and macro alignment with current news. Be honest — most signals score 40-70.",
          },
          {
            role: "user",
             content: `Score this signal.

Symbol: ${symbol}
Direction: ${direction.toUpperCase()}
Entry: ${entry}
Stop loss: ${sl ?? "n/a"}
Take profit: ${tp ?? "n/a"}
Author: ${author}

## Fresh headlines
${newsBlock}`,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "score_signal" } },
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

    return new Response(JSON.stringify({ ...parsed, generatedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-signal-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
