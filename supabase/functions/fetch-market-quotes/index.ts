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

// Stooq symbols. Verified working list (RUT/VIX not on Stooq's free CSV).
const INDICES: Array<{ stooq: string; label: string }> = [
  { stooq: "^spx",  label: "S&P 500" },
  { stooq: "^ndx",  label: "Nasdaq 100" },
  { stooq: "^dji",  label: "Dow Jones" },
  { stooq: "^dax",  label: "DAX 40" },
  { stooq: "^ftm",  label: "FTSE 100" },
  { stooq: "^n225", label: "Nikkei 225" },
];

const STOCKS: Array<{ stooq: string; label: string }> = [
  { stooq: "aapl.us",  label: "AAPL"  },
  { stooq: "msft.us",  label: "MSFT"  },
  { stooq: "nvda.us",  label: "NVDA"  },
  { stooq: "tsla.us",  label: "TSLA"  },
  { stooq: "amzn.us",  label: "AMZN"  },
  { stooq: "meta.us",  label: "META"  },
  { stooq: "googl.us", label: "GOOGL" },
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

function getPrevBusinessDay(d: Date, skip = 1): string {
  const x = new Date(d);
  let n = 0;
  do {
    x.setDate(x.getDate() - 1);
    if (x.getDay() !== 0 && x.getDay() !== 6) n++;
  } while (n < skip);
  return x.toISOString().slice(0, 10);
}

async function fetchForex(): Promise<Quote[]> {
  try {
    const bases = [...new Set(FOREX.map((p) => p.split("/")[0]))];
    // Use 1 and 2 business days back so we always have a non-zero delta even
    // if "latest" coincides with the most recent business day already.
    const prev1 = getPrevBusinessDay(new Date(), 1);
    const prev2 = getPrevBusinessDay(new Date(), 2);
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
    const [latest, p1, p2] = await Promise.all([
      fetchSet("latest"),
      fetchSet(prev1),
      fetchSet(prev2),
    ]);
    const toMap = (set: Awaited<ReturnType<typeof fetchSet>>) => {
      const m: Record<string, Record<string, number>> = {};
      for (const x of set) m[x.base] = x.rates;
      return m;
    };
    const lm = toMap(latest);
    const m1 = toMap(p1);
    const m2 = toMap(p2);
    return FOREX.map((p) => {
      const [from, to] = p.split("/");
      const price = lm[from]?.[to] ?? null;
      // Pick the prev that actually differs from latest.
      let prevPrice: number | null = null;
      for (const m of [m1, m2]) {
        const v = m[from]?.[to];
        if (v != null && price != null && Math.abs(v - price) > 1e-9) {
          prevPrice = v;
          break;
        }
      }
      const changePct =
        price != null && prevPrice != null && prevPrice !== 0
          ? ((price - prevPrice) / prevPrice) * 100
          : 0;
      return { symbol: p, assetClass: "forex" as const, price, changePct };
    });
  } catch {
    return FOREX.map((p) => ({
      symbol: p, assetClass: "forex" as const, price: null, changePct: null,
    }));
  }
}

// Stooq returns CSV: "Symbol,Open,High,Low,Close,Volume".
// Multi-symbol calls return broken rows, so we fan out per symbol.
async function fetchStooq(
  list: Array<{ stooq: string; label: string }>,
  assetClass: "index" | "stock",
): Promise<Quote[]> {
  const results = await Promise.all(
    list.map(async (s) => {
      try {
        const r = await fetch(
          `https://stooq.com/q/l/?s=${encodeURIComponent(s.stooq)}&f=sohlcv&h&e=csv`,
          {
            headers: {
              "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
              accept: "text/csv,*/*",
            },
          },
        );
        const text = await r.text();
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) {
          console.log(`stooq ${s.stooq}: ${text.slice(0, 120)}`);
          return { symbol: s.label, assetClass, price: null, changePct: null } as Quote;
        }
        const cols = lines[1].split(",");
        const open = parseFloat(cols[1] ?? "");
        const close = parseFloat(cols[4] ?? "");
        const price = Number.isFinite(close) ? close : null;
        const o = Number.isFinite(open) ? open : null;
        const changePct =
          price != null && o != null && o !== 0
            ? ((price - o) / o) * 100
            : null;
        if (price == null) console.log(`stooq ${s.stooq} parse fail: ${lines[1]}`);
        return { symbol: s.label, assetClass, price, changePct } as Quote;
      } catch (e) {
        console.log(`stooq ${s.stooq} fetch err: ${(e as Error).message}`);
        return { symbol: s.label, assetClass, price: null, changePct: null } as Quote;
      }
    }),
  );
  return results;
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
      fetchStooq(INDICES, "index"),
      fetchStooq(STOCKS, "stock"),
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
