import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Auth context
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for writes
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Compute current week start (Monday)
    const now = new Date();
    const day = now.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - offset);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    // Fetch user's last 7 days of closed trades
    const { data: trades } = await supabase
      .from("trade_journal")
      .select("pair, direction, pnl, r_multiple, opened_at, closed_at, setup_tag, notes")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .not("pnl", "is", null)
      .gte("closed_at", weekStart.toISOString())
      .order("closed_at", { ascending: true });

    const closed = trades ?? [];
    const totalTrades = closed.length;
    const totalPnl = closed.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const wins = closed.filter((t: any) => (t.pnl ?? 0) > 0);
    const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;

    let summary: string;
    if (totalTrades === 0) {
      summary = "No closed trades this week. Consider reviewing your watchlist and setup criteria — discipline in waiting for high-quality setups is a skill.";
    } else {
      // Call Lovable AI Gateway
      const tradesText = closed
        .slice(0, 30)
        .map((t: any) => `${t.pair} ${t.direction.toUpperCase()} P&L=${t.pnl} R=${t.r_multiple ?? "n/a"} setup=${t.setup_tag ?? "n/a"}`)
        .join("\n");

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a professional trading coach. Write a concise weekly performance review (max 180 words) covering: what worked, what didn't, and ONE concrete improvement focus for next week. Use a direct, supportive tone. No headers, just paragraphs.",
            },
            {
              role: "user",
              content: `Trader's week:\n- Trades: ${totalTrades}\n- Total P&L: ${totalPnl.toFixed(2)}\n- Win rate: ${winRate.toFixed(1)}%\n\nIndividual trades:\n${tradesText}`,
            },
          ],
        }),
      });

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!aiResp.ok) {
        const text = await aiResp.text();
        throw new Error(`AI gateway error: ${text}`);
      }
      const aiJson = await aiResp.json();
      summary = aiJson.choices?.[0]?.message?.content?.trim() ?? "Unable to generate summary.";
    }

    // Upsert
    const { data: report, error: insertErr } = await supabase
      .from("weekly_reports")
      .upsert(
        {
          user_id: user.id,
          week_start: weekStartIso,
          summary,
          metrics: { trades: totalTrades, pnl: totalPnl, win_rate: winRate },
        },
        { onConflict: "user_id,week_start" }
      )
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
