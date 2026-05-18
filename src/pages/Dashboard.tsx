import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Loader2,
  Activity,
  User,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/SEO";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import TradingViewAdvancedIframe from "@/components/dashboard/TradingViewAdvancedIframe";
import BlackArrowTradePanel from "@/components/dashboard/BlackArrowTradePanel";
import OpenPositionsPanel from "@/components/livechart/OpenPositionsPanel";
import TerminalExecutionLog from "@/components/dashboard/TerminalExecutionLog";
import TradeJournal from "@/components/dashboard/TradeJournal";
import {
  LiveAccountProvider,
  useLiveAccount,
  fmtMoney,
} from "@/contexts/LiveAccountContext";
import {
  BrokerSymbolsProvider,
  useBrokerSymbols,
} from "@/contexts/BrokerSymbolsContext";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { MARKET_UNIVERSE } from "@/lib/markets";
import { useLanguage } from "@/i18n/LanguageContext";
import AICopilot from "@/components/ai/AICopilot";
import PerformanceCoach from "@/components/ai/PerformanceCoach";
import CopiedTradesPerformance from "@/components/copytrade/CopiedTradesPerformance";

const TIMEFRAMES = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
];

/** Map broker symbol → TradingView symbol. */
function brokerToTv(sym: string): string {
  const u = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const direct = MARKET_UNIVERSE.find(
    (m) => m.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") === u,
  );
  if (direct) return direct.tv;
  if (u === "XAUUSD" || u === "GOLD") return "OANDA:XAUUSD";
  if (u === "XAGUSD" || u === "SILVER") return "OANDA:XAGUSD";
  if (u === "BTCUSD") return "BINANCE:BTCUSDT";
  if (u === "ETHUSD") return "BINANCE:ETHUSDT";
  if (u === "US30" || u === "DJ30") return "TVC:DJI";
  if (u === "NAS100" || u === "USTEC") return "TVC:NDX";
  if (u === "SPX500" || u === "US500") return "TVC:SPX";
  if (u === "GER40" || u === "DAX40") return "TVC:DAX";
  if (/^[A-Z]{6}$/.test(u)) return `FX:${u}`;
  if (u.endsWith("USDT")) return `BINANCE:${u}`;
  if (/^[A-Z]{1,5}$/.test(u)) return `NASDAQ:${u}`;
  return u;
}

const HeaderStat = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "primary";
}) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">
      {label}
    </span>
    <span
      className={`font-mono text-[12px] font-bold tabular-nums ${
        tone === "positive"
          ? "text-emerald-400"
          : tone === "negative"
            ? "text-red-400"
            : tone === "primary"
              ? "text-[#FFCD05]"
              : "text-neutral-100"
      }`}
    >
      {value}
    </span>
  </div>
);

const TerminalHeader = () => {
  const { liveAccount, connected, refreshing, refresh } = useLiveAccount();
  const c = liveAccount?.currency ?? "USD";
  const pnl = liveAccount?.profit ?? 0;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-[#0a0a0a]/95 backdrop-blur-xl">
      <div className="flex h-11 items-center gap-3 px-3 sm:px-4 pl-14 lg:pl-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#FFCD05] text-black">
            <Activity className="h-3.5 w-3.5" strokeWidth={3} />
          </div>
          <span className="font-heading text-[13px] font-bold tracking-[0.14em] text-neutral-100">
            INFINOX <span className="text-[#FFCD05]">IX</span> TERMINAL
          </span>
        </div>

        {connected && liveAccount ? (
          <div className="flex items-center gap-4 ml-2 pl-3 border-l border-neutral-800 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                MT5 LIVE
              </span>
            </div>
            <HeaderStat label="Account" value={`#${liveAccount.login}`} />
            <HeaderStat label="Server" value={liveAccount.server || "—"} />
            <HeaderStat label="Balance" value={fmtMoney(liveAccount.balance, c)} />
            <HeaderStat
              label="Equity"
              value={fmtMoney(liveAccount.equity, c)}
              tone="primary"
            />
            <HeaderStat
              label="Floating P&L"
              value={fmtMoney(pnl, c)}
              tone={pnl >= 0 ? "positive" : "negative"}
            />
            <HeaderStat label="Margin" value={fmtMoney(liveAccount.margin, c)} />
            <HeaderStat
              label="Free Margin"
              value={fmtMoney(liveAccount.marginFree, c)}
              tone="positive"
            />
          </div>
        ) : (
          <span className="ml-2 pl-3 border-l border-neutral-800 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            ● MT5 disconnected
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            title="Refresh account"
            className="flex h-7 w-7 items-center justify-center rounded border border-neutral-800 bg-[#0f0f0f] text-neutral-400 hover:text-[#FFCD05] hover:border-[#FFCD05]/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <NotificationsBell />
          <Link
            to="/profile"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFCD05] text-[11px] font-bold text-black hover:bg-[#FFCD05]/85 transition-colors"
            aria-label="Profile"
          >
            <User className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
};

const MarketWatchPanel = ({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (sym: string) => void;
}) => {
  const { symbols, loading, isLive } = useBrokerSymbols();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | string>("all");

  const assetClasses = useMemo(() => {
    const set = new Set<string>();
    symbols.forEach((s) => {
      const c = (s.assetClass || "").trim();
      if (c) set.add(c);
    });
    return ["all", ...Array.from(set).sort()];
  }, [symbols]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return symbols
      .filter((s) => (tab === "all" ? true : (s.assetClass || "") === tab))
      .filter((s) => {
        if (!q) return true;
        return (
          (s.brokerSymbol || s.symbol).toUpperCase().includes(q) ||
          (s.description || "").toUpperCase().includes(q)
        );
      })
      .slice(0, 500);
  }, [symbols, query, tab]);

  return (
    <aside className="hidden lg:flex flex-col rounded-md border border-neutral-800/80 bg-[#0f0f0f] overflow-hidden h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-3 py-2">
        <h2 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
          Market Watch
        </h2>
        <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
          {isLive ? (
            <span className="text-emerald-400">● {symbols.length}</span>
          ) : loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-[#FFCD05]" />
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </span>
      </div>
      <div className="px-2 py-2 border-b border-neutral-800/80">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols…"
            className="h-7 pl-7 bg-[#050505] border-neutral-800 text-[11px] font-mono placeholder:text-neutral-600 focus-visible:ring-[#FFCD05]/40 rounded"
          />
        </div>
        {assetClasses.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {assetClasses.slice(0, 6).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTab(c)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest border transition-colors ${
                  tab === c
                    ? "bg-[#FFCD05]/15 border-[#FFCD05]/40 text-[#FFCD05]"
                    : "border-neutral-800 text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-neutral-800/80 bg-[#0a0a0a] px-3 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500">
        <span>Symbol</span>
        <span>Digits</span>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-neutral-800/60">
        {loading && filtered.length === 0 && (
          <li className="px-3 py-5 text-center text-[11px] text-neutral-500 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading broker symbols…
          </li>
        )}
        {!loading && filtered.length === 0 && (
          <li className="px-3 py-5 text-center text-[11px] text-neutral-500">
            No matches.
          </li>
        )}
        {filtered.map((s) => {
          const sym = s.brokerSymbol || s.symbol;
          const isActive = sym.toUpperCase() === active.toUpperCase();
          return (
            <li key={sym}>
              <button
                type="button"
                onClick={() => onSelect(sym)}
                className={`w-full grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  isActive
                    ? "bg-[#FFCD05]/10 text-[#FFCD05]"
                    : "text-neutral-200 hover:bg-neutral-900/60"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] font-bold truncate">{sym}</div>
                  {s.description && (
                    <div className="text-[9px] text-neutral-500 truncate">
                      {s.description}
                    </div>
                  )}
                </div>
                <span className="font-mono text-[9px] tabular-nums text-neutral-500">
                  {s.digits ?? "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

const ChartBidAskHeader = () => {
  const { tick, selectedSymbolInfo } = useBrokerSymbols();
  const digits = Number(selectedSymbolInfo?.digits) || 5;
  const fmt = (v: number | null | undefined) =>
    v == null
      ? "—"
      : Number(v).toLocaleString("en-US", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const spread = bid != null && ask != null ? Math.max(0, ask - bid) : null;
  const spreadPts =
    spread != null && selectedSymbolInfo?.point
      ? spread / Number(selectedSymbolInfo.point)
      : null;

  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-red-400/80">
          Bid
        </span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-red-400">
          {fmt(bid)}
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-400/80">
          Ask
        </span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-emerald-400">
          {fmt(ask)}
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Spread
        </span>
        <span className="font-mono text-[12px] tabular-nums text-neutral-300">
          {spreadPts != null ? `${spreadPts.toFixed(1)} pts` : "—"}
        </span>
      </div>
    </div>
  );
};

const BottomTabs = () => {
  const { liveAccount, connected } = useLiveAccount();
  const c = liveAccount?.currency ?? "USD";

  return (
    <div className="rounded-md border border-neutral-800/80 bg-[#0f0f0f] overflow-hidden">
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-neutral-800/80 bg-[#0a0a0a] h-9 p-0">
          {[
            { v: "positions", l: "Positions" },
            { v: "orders", l: "Orders" },
            { v: "executions", l: "Execution Log" },
            { v: "account", l: "Account" },
            { v: "copy", l: "Copy P&L" },
            { v: "journal", l: "Journal" },
            { v: "coach", l: "AI Coach" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-none border-r border-neutral-800/80 h-9 px-4 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-neutral-400 data-[state=active]:bg-[#0f0f0f] data-[state=active]:text-[#FFCD05] data-[state=active]:border-b-2 data-[state=active]:border-b-[#FFCD05]"
            >
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="positions" className="m-0 p-0">
          <OpenPositionsPanel />
        </TabsContent>

        <TabsContent value="orders" className="m-0 p-6">
          <div className="text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            No pending orders.
          </div>
        </TabsContent>

        <TabsContent value="executions" className="m-0 p-0">
          <TerminalExecutionLog />
        </TabsContent>

        <TabsContent value="account" className="m-0 p-4">
          {!connected || !liveAccount ? (
            <div className="text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              MT5 account not connected.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Login", `#${liveAccount.login}`],
                ["Server", liveAccount.server || "—"],
                ["Currency", liveAccount.currency || "USD"],
                ["Leverage", liveAccount.leverage ? `1:${liveAccount.leverage}` : "—"],
                ["Balance", fmtMoney(liveAccount.balance, c)],
                ["Equity", fmtMoney(liveAccount.equity, c)],
                ["Margin", fmtMoney(liveAccount.margin, c)],
                ["Free Margin", fmtMoney(liveAccount.marginFree, c)],
                ["Floating P&L", fmtMoney(liveAccount.profit, c)],
                ["Open Positions", String(liveAccount.openPositionsCount)],
                ["Status", liveAccount.status],
                [
                  "Last Sync",
                  liveAccount.lastSynced
                    ? new Date(liveAccount.lastSynced).toLocaleTimeString()
                    : "—",
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded border border-neutral-800/80 bg-[#0a0a0a] px-3 py-2"
                >
                  <div className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
                    {k}
                  </div>
                  <div className="font-mono text-[12px] font-bold tabular-nums text-neutral-100 mt-0.5">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="copy" className="m-0 p-3">
          <CopiedTradesPerformance />
        </TabsContent>

        <TabsContent value="journal" className="m-0 p-3">
          <TradeJournal />
        </TabsContent>

        <TabsContent value="coach" className="m-0 p-3">
          <PerformanceCoach />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DashboardInner = () => {
  const { t } = useLanguage();
  const { symbols, setSelectedBrokerSymbol } = useBrokerSymbols();
  const { setSymbol: setCtxSymbol, openTrade } = useQuickTrade();
  const [active, setActive] = useState<string>("EURUSD");
  const [interval, setInterval] = useState("15");
  const [searchParams, setSearchParams] = useSearchParams();
  const consumedPrefillRef = useRef(false);

  // Default to first available broker symbol once loaded
  useEffect(() => {
    if (!symbols.length) return;
    const pick =
      symbols.find((s) => (s.brokerSymbol || s.symbol).toUpperCase() === "EURUSD")
        ?.brokerSymbol ||
      symbols[0].brokerSymbol ||
      symbols[0].symbol;
    setActive((cur) => (cur === "EURUSD" ? pick : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.length]);

  // Apply "Take This Signal" URL params: ?symbol=&side=&lots=&entry=&sl=&tp=&signalId=
  useEffect(() => {
    if (consumedPrefillRef.current) return;
    const symbol = searchParams.get("symbol");
    if (!symbol) return;
    consumedPrefillRef.current = true;
    const sideParam = (searchParams.get("side") || "buy").toLowerCase();
    const side: "buy" | "sell" = sideParam === "sell" ? "sell" : "buy";
    const upper = symbol.toUpperCase();
    setActive(upper);
    openTrade({
      symbol: upper,
      side,
      lots: searchParams.get("lots") || undefined,
      entry: searchParams.get("entry") || undefined,
      sl: searchParams.get("sl") || undefined,
      tp: searchParams.get("tp") || undefined,
      signalId: searchParams.get("signalId"),
      mentor: searchParams.get("mentor"),
      riskPct: searchParams.get("riskPct") ? Number(searchParams.get("riskPct")) : undefined,
    });
    // Clean params from URL so refresh doesn't re-apply
    const next = new URLSearchParams(searchParams);
    ["symbol", "side", "lots", "entry", "sl", "tp", "signalId", "mentor", "riskPct"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, openTrade, setSearchParams]);

  const tvSymbol = useMemo(() => brokerToTv(active), [active]);

  // Sync to QuickTrade context so Order Entry trades the chart symbol.
  useEffect(() => {
    setCtxSymbol(active);
    setSelectedBrokerSymbol(active);
  }, [active, setCtxSymbol, setSelectedBrokerSymbol]);

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100">
      <SEO
        title={t("dash.seo.title")}
        description={t("dash.seo.desc")}
        keywords={t("dash.seo.keywords")}
        canonical="https://www.salatradingelite.com/dashboard"
      />

      <TerminalHeader />

      <div className="p-2 lg:p-3">
        <div className="grid gap-2 lg:gap-3 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
          {/* LEFT — Market Watch */}
          <MarketWatchPanel active={active} onSelect={setActive} />

          {/* CENTER — Bid/Ask + Chart + Tabs */}
          <section className="flex flex-col gap-2 lg:gap-3 min-w-0">
            <div className="rounded-md border border-neutral-800/80 bg-[#0f0f0f] overflow-hidden">
              {/* Chart toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-heading text-[14px] font-bold tracking-wide text-neutral-100">
                    {active}
                  </span>
                  <ChartBidAskHeader />
                </div>
                <div className="flex items-center gap-0.5 rounded border border-neutral-800 bg-[#050505] p-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setInterval(tf.value)}
                      className={`rounded px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                        interval === tf.value
                          ? "bg-[#FFCD05] text-black"
                          : "text-neutral-400 hover:text-neutral-100"
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Chart canvas */}
              <div className="relative h-[60vh] lg:h-[calc(100vh-22rem)]">
                <TradingViewAdvancedIframe
                  key={`${tvSymbol}-${interval}`}
                  symbol={tvSymbol}
                  interval={interval}
                  height="100%"
                  allowSymbolChange={false}
                  hideSideToolbar={false}
                  withDateRanges={true}
                  saveImage={true}
                />
              </div>
            </div>

            {/* Bottom tabs */}
            <BottomTabs />
          </section>

          {/* RIGHT — Order Entry */}
          <aside className="lg:h-[calc(100vh-7rem)] lg:overflow-y-auto pr-0.5">
            <BlackArrowTradePanel />
          </aside>
        </div>
      </div>
      <AICopilot />
    </div>
  );
};

const Dashboard = () => (
  <LiveAccountProvider>
    <BrokerSymbolsProvider>
      <DashboardInner />
    </BrokerSymbolsProvider>
  </LiveAccountProvider>
);

export default Dashboard;
