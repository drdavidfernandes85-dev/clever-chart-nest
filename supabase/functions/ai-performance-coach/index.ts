// AI Performance Coach — analyzes user's recent journaled trades and returns
// strengths, weaknesses, and 3 concrete improvements.
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

const EMPTY_MSG: Record<string, string> = {
  en: "No closed trades yet. Log at least 5 trades in your journal so the coach can analyze your edge.",
  es: "Aún no hay operaciones cerradas. Registra al menos 5 operaciones en tu diario para que el coach pueda analizar tu edge.",
  pt: "Ainda sem operações fechadas. Registre pelo menos 5 operações em seu diário para que o coach possa analisar seu edge.",
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

    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: trades } = await supabase
      .from("trade_journal")
      .select("pair, direction, entry_price, exit_price, pnl, r_multiple, setup_tag, status, opened_at, closed_at, notes")
      .eq("user_id", user.id)
      .order("opened_at", { ascending: false })
      .limit(30);

    const closed = (trades ?? []).filter((t: any) => t.status === "closed" && t.pnl != null);

    if (closed.length === 0) {
      return new Response(
        JSON.stringify({
          empty: true,
          message: EMPTY_MSG[locale] || EMPTY_MSG.en,
          generatedAt: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trade_list = closed
      .map(
        (t: any) =>
          `- ${t.pair} ${String(t.direction).toUpperCase()} | entry ${t.entry_price} → exit ${t.exit_price ?? "?"} | PnL ${Number(t.pnl).toFixed(2)} | R ${t.r_multiple ?? "?"} | setup ${t.setup_tag ?? "—"}${t.notes ? ` | notes: ${String(t.notes).slice(0, 80)}` : ""}`,
      )
      .join("\n");

    const wins = closed.filter((t: any) => Number(t.pnl) > 0).length;
    const winRate = ((wins / closed.length) * 100).toFixed(1);
    const totalPnl = closed.reduce((s: number, t: any) => s + Number(t.pnl), 0).toFixed(2);

    const tools = [
      {
        type: "function",
        function: {
          name: "render_coaching",
          description: "Personalized trading performance coaching report.",
          parameters: {
            type: "object",
            properties: {
              headline: { type: "string", description: "1-sentence honest verdict on the trader's recent edge." },
              strengths: { type: "array", items: { type: "string" }, description: "2-3 specific strengths." },
              weaknesses: { type: "array", items: { type: "string" }, description: "2-3 specific weaknesses." },
              action_items: {
                type: "array",
                description: "Exactly 3 concrete behavioral changes for next week.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                  },
                  required: ["title", "detail"],
                  additionalProperties: false,
                },
              },
            },
            required: ["headline", "strengths", "weaknesses", "action_items"],
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
              `You are an elite trading performance coach. You read a trader's recent log and return honest, specific, actionable feedback — never generic platitudes. Cite the trader's own pairs and setups. Write all output fields (headline, strengths, weaknesses, action_items.title, action_items.detail) in ${LANG_NAME[locale]}. Keep ticker symbols (EUR/USD, XAU/USD, etc.) in their original form.`,
          },
          {
            role: "user",
            content: `Analyze the trader's last ${closed.length} closed trades.

Win rate: ${winRate}%
Total PnL: ${totalPnl}

## TRADES
${trade_list}`,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "render_coaching" } },
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
      JSON.stringify({
        ...parsed,
        stats: { trades: closed.length, win_rate: Number(winRate), total_pnl: Number(totalPnl) },
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-performance-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
