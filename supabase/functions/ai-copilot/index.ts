// AI Co-pilot streaming chat endpoint
// Uses Lovable AI Gateway with context from news, calendar, signals, and user trade journal

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish (Español)",
  pt: "Brazilian Portuguese (Português do Brasil)",
};

async function fetchContext(supabase: ReturnType<typeof createClient>, userId: string | null, locale: string = "en") {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const projectRef = supabaseUrl.split("//")[1].split(".")[0];

  // Fetch news, calendar (best-effort)
  const [newsRes, calRes] = await Promise.allSettled([
    fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-rss-news`, {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    }).then((r) => r.json()),
    fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-economic-calendar`, {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    }).then((r) => r.json()),
  ]);

  const newsArr = newsRes.status === "fulfilled" ? newsRes.value?.data || newsRes.value?.news || newsRes.value || [] : [];
  const calArr = calRes.status === "fulfilled" ? calRes.value?.data || calRes.value?.events || calRes.value || [] : [];
  const news = Array.isArray(newsArr) ? newsArr.slice(0, 10) : [];
  const calendar = Array.isArray(calArr) ? calArr.slice(0, 8) : [];

  // Active signals
  const { data: signals } = await supabase
    .from("trading_signals")
    .select("pair, direction, entry_price, stop_loss, take_profit, status, notes")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  // User trade journal (only if logged in)
  let trades: any[] = [];
  let stats: any = null;
  let portfolio: any = null;
  let positions: any[] = [];
  let leaderboard: any[] = [];
  if (userId) {
    const { data } = await supabase
      .from("trade_journal")
      .select("pair, direction, entry_price, exit_price, pnl, r_multiple, status, setup_tag, opened_at, closed_at")
      .eq("user_id", userId)
      .order("opened_at", { ascending: false })
      .limit(30);
    trades = data || [];

    const closed = trades.filter((t) => t.status === "closed" && t.pnl != null);
    if (closed.length > 0) {
      const wins = closed.filter((t) => Number(t.pnl) > 0).length;
      const totalPnl = closed.reduce((s, t) => s + Number(t.pnl || 0), 0);
      stats = {
        totalTrades: closed.length,
        winRate: ((wins / closed.length) * 100).toFixed(1) + "%",
        totalPnl: totalPnl.toFixed(2),
        openTrades: trades.filter((t) => t.status === "open").length,
      };
    }

    // MT5 portfolio snapshot
    const { data: acct } = await supabase
      .from("user_mt_accounts")
      .select("id, login, server_name, currency, leverage, balance, equity, margin, free_margin, margin_level, status, last_synced_at, broker_name")
      .eq("user_id", userId)
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (acct) {
      portfolio = acct;
      // mt_positions removed — copilot no longer reads cached positions.
      positions = [];

    }

    // Top traders leaderboard (last 30d)
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: tj } = await supabase
      .from("trade_journal")
      .select("user_id, pnl")
      .eq("status", "closed")
      .gte("closed_at", since)
      .not("pnl", "is", null)
      .limit(2000);
    if (tj?.length) {
      const agg = new Map<string, { pnl: number; trades: number; wins: number }>();
      for (const r of tj as any[]) {
        const p = Number(r.pnl) || 0;
        const cur = agg.get(r.user_id) || { pnl: 0, trades: 0, wins: 0 };
        cur.pnl += p; cur.trades += 1; if (p > 0) cur.wins += 1;
        agg.set(r.user_id, cur);
      }
      const ranked = [...agg.entries()].map(([uid, v]) => ({ user_id: uid, ...v })).sort((a, b) => b.pnl - a.pnl);
      const topIds = ranked.slice(0, 10).map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", topIds);
      const nameById = new Map((profs || []).map((p: any) => [p.user_id, p.display_name]));
      leaderboard = ranked.slice(0, 10).map((r, i) => ({
        rank: i + 1,
        name: nameById.get(r.user_id) || "Anonymous",
        pnl: r.pnl.toFixed(2),
        trades: r.trades,
        winRate: ((r.wins / r.trades) * 100).toFixed(1) + "%",
        isYou: r.user_id === userId,
      }));
    }
  }

  return { news, calendar, signals: signals || [], trades, stats, portfolio, positions, leaderboard, language: LANG_NAME[locale] || LANG_NAME.en };
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof fetchContext>>) {
  const newsLines = ctx.news
    .slice(0, 8)
    .map((n: any) => `- [${n.category || n.source || "NEWS"}] ${n.title}`)
    .join("\n");
  const calLines = ctx.calendar
    .slice(0, 6)
    .map(
      (e: any) =>
        `- ${e.time || e.date || ""} ${e.country || e.currency || ""} ${e.event || e.name || ""} (impact: ${e.impact || "n/a"})`,
    )
    .join("\n");
  const sigLines = ctx.signals
    .slice(0, 6)
    .map(
      (s: any) =>
        `- ${s.pair} ${s.direction?.toUpperCase()} @ ${s.entry_price}, SL ${s.stop_loss ?? "n/a"}, TP ${s.take_profit ?? "n/a"}`,
    )
    .join("\n");
  const tradeLines = ctx.trades
    .slice(0, 8)
    .map(
      (t: any) =>
        `- ${t.pair} ${t.direction} entry ${t.entry_price}${t.exit_price ? ` exit ${t.exit_price}` : ""} pnl ${t.pnl ?? "open"}${t.setup_tag ? ` [${t.setup_tag}]` : ""}`,
    )
    .join("\n");
  const statsLine = ctx.stats
    ? `User stats: ${ctx.stats.totalTrades} closed trades, win rate ${ctx.stats.winRate}, total P&L ${ctx.stats.totalPnl}, ${ctx.stats.openTrades} open.`
    : "User has no closed trades yet.";

  const portfolio: any = (ctx as any).portfolio;
  const positions: any[] = (ctx as any).positions || [];
  const leaderboard: any[] = (ctx as any).leaderboard || [];
  const portfolioBlock = portfolio
    ? `Account #${portfolio.login} @ ${portfolio.broker_name || portfolio.server_name} (${portfolio.status})
Balance ${portfolio.balance ?? "?"} ${portfolio.currency || "USD"} · Equity ${portfolio.equity ?? "?"} · Margin ${portfolio.margin ?? "?"} · Free Margin ${portfolio.free_margin ?? "?"} · Leverage 1:${portfolio.leverage ?? "?"}`
    : "No MT5 account connected.";
  const positionsBlock = positions.length
    ? positions
        .slice(0, 12)
        .map(
          (p: any) =>
            `- ${p.symbol} ${String(p.side).toUpperCase()} ${p.volume} lots @ ${p.open_price} (now ${p.current_price ?? "?"}) SL ${p.stop_loss ?? "-"} TP ${p.take_profit ?? "-"} P&L ${p.profit ?? 0}`,
        )
        .join("\n")
    : "No open positions.";
  const leaderboardBlock = leaderboard.length
    ? leaderboard.map((r: any) => `${r.rank}. ${r.name}${r.isYou ? " (YOU)" : ""} — P&L ${r.pnl}, ${r.trades} trades, win rate ${r.winRate}`).join("\n")
    : "Leaderboard unavailable.";

  return `You are **Infinox AI Co-pilot**, an elite trading co-pilot for the IX LTR community.

Your job: answer questions about markets, signals, the user's portfolio & performance, news, and macro events.
Be concise, professional, and data-driven. Use markdown formatting (lists, bold, tables when useful).
Never give financial advice — frame insights as analysis or education.

LANGUAGE: Always respond in ${ctx.language}. Keep ticker symbols (EUR/USD, XAU/USD, NAS100, BTC/USD, etc.) in their original form. If the user writes in a different language, still reply in ${ctx.language} unless they explicitly ask otherwise.

## Live Context (refreshed each conversation)

### Top news headlines
${newsLines || "No news available."}

### Today's economic calendar
${calLines || "No high-impact events."}

### Active trading signals
${sigLines || "No active signals right now."}

### User's MT5 portfolio
${portfolioBlock}

### User's open positions
${positionsBlock}

### User's recent trades
${tradeLines || "No trades logged."}
${statsLine}

### Top 10 traders (last 30d)
${leaderboardBlock}

When the user asks "analyze my portfolio" — summarize balance/equity/margin, total exposure, concentration risk per symbol, and concrete suggestions.
When they ask "what is my risk level?" — compute used margin %, free margin buffer, biggest open-position risk, and rate risk Low/Moderate/High/Extreme.
When they ask "explain this signal" — break down direction, entry, SL/TP, R:R, and macro context from news/calendar.
When they ask "market outlook for X" — combine news + calendar + active signals for that pair.
When they ask how they compare to top traders — reference the leaderboard block above.
Keep responses under 220 words unless detail is requested.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const reqBody = (await req.json()) as { messages: ChatMessage[]; locale?: string };
    const { messages } = reqBody;
    const locale = reqBody?.locale && LANG_NAME[reqBody.locale] ? reqBody.locale : "en";
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify user from JWT (optional)
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
      if (userId) {
        // Use authenticated client for RLS
        const authedClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const ctx = await fetchContext(authedClient, userId, locale);
        const systemPrompt = buildSystemPrompt(ctx);
        return await callAI(systemPrompt, messages, LOVABLE_API_KEY);
      }
    }

    const ctx = await fetchContext(supabase, null, locale);
    const systemPrompt = buildSystemPrompt(ctx);
    return await callAI(systemPrompt, messages, LOVABLE_API_KEY);
  } catch (e) {
    console.error("ai-copilot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(systemPrompt: string, messages: ChatMessage[], apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429)
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (response.status === 402)
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const text = await response.text();
    console.error("Gateway error:", response.status, text);
    return new Response(JSON.stringify({ error: "AI gateway error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
