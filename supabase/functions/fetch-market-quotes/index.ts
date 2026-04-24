// Mixed-asset quote proxy. Returns live spot prices + 24h/intraday change
// for a curated list of crypto, forex, indices and major US stocks.
//
// No API key required:
//  - Crypto  → CoinGecko /simple/price
//  - Forex   → Frankfurter /latest + previous business day
//  - Indices & Stocks → Yahoo Finance v7/finance/quote (server-side fetch
//    avoids the browser CORS restriction).
//
// Public endpoint — no auth required. (See supabase/config.toml.)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Quote = {
  symbol: string;          // pretty label, e.g. "BTC/USDT", "EUR/USD", "SPX", "AAPL"
  assetClass: "crypto" | "forex" | "index" | "stock";
  price: number | null;
  changePct: number | null;
  volume?: string;         // informational rough 24h volume label
};

// ── Universe ─────────────────────────────────────────────────────────
const CRYPTO = [
  { symbol: "BTC/USDT",  id: "bitcoin",      volume: "32B" },
  { symbol: "ETH/USDT",  id: "ethereum",     volume: "18B" },
  { symbol: "SOL/USDT",  id: "solana",       volume: "4.2B" },
  { symbol: "XRP/USDT",  id: "ripple",       volume: "2.1B" },
  { symbol: "BNB/USDT",  id: "binancecoin",  volume: "1.6B" },
  { symbol: "DOGE/USDT", id: "dogecoin",     volume: "1.2B" },
];

const FOREX = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "USD/CHF", "NZD/USD", "EUR/GBP",
];

// Yahoo Finance symbols. Indices use the ^ prefix.
const INDICES: Array<{ yahoo: string; label: string }> = [
  { yahoo: "^GSPC", label: "S&P 500" },
  { yahoo: "^NDX",  label: "Nasdaq 100" },
  { yahoo: "^DJI",  label: "Dow Jones" },
  { yahoo: "^RUT",  label: "Russell 2000" },
  { yahoo: "^VIX",  label: "VIX" },
  { yahoo: "^GDAXI", label: "DAX 40" },
];

const STOCKS: Array<{ yahoo: string; label: string }> = [
  { yahoo: "AAPL",  label: "AAPL"  },
  { yahoo: "MSFT",  label: "MSFT"  },
  { yahoo: "NVDA",  label: "NVDA"  },
  { yahoo: "TSLA",  label: "TSLA"  },
  { yahoo: "AMZN",  label: "AMZN"  },
  { yahoo: "META",  label: "META"  },
  { yahoo: "GOOGL", label: "GOOGL" },
];

// ── Fetchers ─────────────────────────────────────────────────────────
async function fetchCrypto(): Promise<Quote[]> {
  try {
    const ids = CRYPTO.map((c) => c.id).join(",");
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { accept: "application/json" } },
    );
    const j = await r.json();
    return CRYPTO.map((c) => {
      const row = j?.[c.id];
      return {
        symbol: c.symbol,
        assetClass: "crypto" as const,
        price: row?.usd != null ? Number(row.usd) : null,
        changePct: row?.usd_24h_change != null ? Number(row.usd_24h_change) : null,
        volume: c.volume,
      };
    });
  } catch {
    return CRYPTO.map((c) => ({
      symbol: c.symbol, assetClass: "crypto" as const,
      price: null, changePct: null, volume: c.volume,
    }));
  }
}

function getPrevBusinessDay(d: Date): string {
  const x = new Date(d);
  do {
    x.setDate(x.getDate() - 1);
  } while (x.getDay() === 0 || x.getDay() === 6);
  return x.toISOString().slice(0, 10);
}

async function fetchForex(): Promise<Quote[]> {
  try {
    const bases = [...new Set(FOREX.map((p) => p.split("/")[0]))];
    const prev = getPrevBusinessDay(new Date());
    const fetchSet = (endpoint: string) =>
      Promise.all(
        bases.map(async (b) => {
          const tos = FOREX.filter((p) => p.startsWith(b + "/"))
            .map((p) => p.split("/")[1])
            .join(",");
          const r = await fetch(
            `https://api.frankfurter.dev/v1/${endpoint}?base=${b}&symbols=${tos}`,
          );
          const j = await r.json();
          return { base: b, rates: j?.rates ?? {} };
        }),
      );
    const [latest, prior] = await Promise.all([
      fetchSet("latest"),
      fetchSet(prev),
    ]);
    const toMap = (set: Awaited<ReturnType<typeof fetchSet>>) => {
      const m: Record<string, Record<string, number>> = {};
      for (const x of set) m[x.base] = x.rates;
      return m;
    };
    const lm = toMap(latest);
    const pm = toMap(prior);
    return FOREX.map((p) => {
      const [from, to] = p.split("/");
      const price = lm[from]?.[to] ?? null;
      const prevPrice = pm[from]?.[to] ?? null;
      const changePct =
        price != null && prevPrice != null && prevPrice !== 0
          ? ((price - prevPrice) / prevPrice) * 100
          : null;
      return { symbol: p, assetClass: "forex" as const, price, changePct };
    });
  } catch {
    return FOREX.map((p) => ({
      symbol: p, assetClass: "forex" as const, price: null, changePct: null,
    }));
  }
}

async function fetchYahoo(
  list: Array<{ yahoo: string; label: string }>,
  assetClass: "index" | "stock",
): Promise<Quote[]> {
  try {
    const symbols = list.map((s) => s.yahoo).join(",");
    const r = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`,
      { headers: { "user-agent": "Mozilla/5.0 ELTR/1.0" } },
    );
    const j = await r.json();
    const rows = (j?.quoteResponse?.result ?? []) as any[];
    const byYahoo = new Map(rows.map((q) => [q.symbol, q]));
    return list.map((s) => {
      const q = byYahoo.get(s.yahoo);
      return {
        symbol: s.label,
        assetClass,
        price: q?.regularMarketPrice != null ? Number(q.regularMarketPrice) : null,
        changePct:
          q?.regularMarketChangePercent != null
            ? Number(q.regularMarketChangePercent)
            : null,
      };
    });
  } catch {
    return list.map((s) => ({
      symbol: s.label, assetClass, price: null, changePct: null,
    }));
  }
}

// ── Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const [crypto, forex, indices, stocks] = await Promise.all([
      fetchCrypto(),
      fetchForex(),
      fetchYahoo(INDICES, "index"),
      fetchYahoo(STOCKS, "stock"),
    ]);
    const quotes: Quote[] = [...crypto, ...forex, ...indices, ...stocks];
    return new Response(
      JSON.stringify({ quotes, fetchedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
