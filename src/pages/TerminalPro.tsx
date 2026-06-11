/**
 * TerminalPro (/terminal-pro) — Phase 1 shell.
 *
 * Admin-gated rebuild of the live trading terminal. Designed alongside the
 * existing TradingDashboard; nothing in MarketDataService / LiveAccountContext
 * is modified. Reuses the same providers so live account + quote streaming is
 * shared.
 *
 * Phase 1 ships:
 *  - Top account bar (Balance / Equity / Open P&L / Used Margin / Free Margin /
 *    Margin Level) streaming from the live account snapshot.
 *  - Display-currency toggle (account currency + indicative conversions sourced
 *    only from broker FX symbols via get-mt5-quotes; currencies without a
 *    broker cross are hidden).
 *  - One-click trading toggle (state only; consumed by later phases).
 *  - Resizable DXtrade-style region shell with empty-state placeholders.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Activity, ChevronDown, Loader2, Zap, ZapOff } from "lucide-react";

import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { LiveAccountProvider, useLiveAccount, fmtMoney } from "@/contexts/LiveAccountContext";
import { useTerminalProAccountSnapshot } from "@/hooks/useTerminalProAccountSnapshot";
import { BrokerSymbolsProvider } from "@/contexts/BrokerSymbolsContext";
import { useMarketStatus } from "@/hooks/useLiveMarketData";
import { supabase } from "@/integrations/supabase/client";
import TerminalWatchlist from "@/components/terminal/TerminalWatchlist";
import OrderTicket from "@/components/terminal/OrderTicket";
import OrderTicketModal from "@/components/terminal/OrderTicketModal";

/* ─────────── Display currency ─────────── */

const SUPPORTED_DISPLAY_CCY = ["USD", "EUR", "MXN", "COP", "CLP", "PEN", "BRL"] as const;
type Ccy = string;

const ONE_CLICK_KEY = "ltr.terminalPro.oneClick";
const DISPLAY_CCY_KEY = "ltr.terminalPro.displayCcy";

/** Fetch a single broker cross-rate quote via the existing edge function. */
async function fetchCross(symbol: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.functions.invoke("get-mt5-quotes", {
      body: { symbols: [symbol] },
    });
    if (error || !data?.success) return null;
    const q = Array.isArray(data?.quotes) ? data.quotes[0] : null;
    const mid = q?.bid && q?.ask ? (Number(q.bid) + Number(q.ask)) / 2 : null;
    return Number.isFinite(mid) ? mid : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a display-currency conversion factor relative to the account
 * currency by trying both broker symbol orientations. Returns null when the
 * broker offers no cross — caller hides that currency.
 */
function useConversionRate(accountCcy: string | null, displayCcy: Ccy): {
  rate: number | null;
  available: boolean;
  loading: boolean;
} {
  const [rate, setRate] = useState<number | null>(null);
  const [available, setAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!accountCcy || !displayCcy || displayCcy === accountCcy) {
      setRate(1);
      setAvailable(true);
      return;
    }
    setLoading(true);
    (async () => {
      // Try ACCOUNTccy first: 1 unit account = X display
      const direct = await fetchCross(`${accountCcy}${displayCcy}`);
      if (cancelled) return;
      if (direct != null) {
        setRate(direct);
        setAvailable(true);
        setLoading(false);
        return;
      }
      const inverse = await fetchCross(`${displayCcy}${accountCcy}`);
      if (cancelled) return;
      if (inverse != null && inverse !== 0) {
        setRate(1 / inverse);
        setAvailable(true);
      } else {
        setRate(null);
        setAvailable(false);
      }
      setLoading(false);
    })();

    // Refresh every 30s while toggle is active.
    const id = window.setInterval(() => {
      if (!accountCcy || displayCcy === accountCcy) return;
      fetchCross(`${accountCcy}${displayCcy}`).then((d) => {
        if (cancelled) return;
        if (d != null) { setRate(d); setAvailable(true); return; }
        fetchCross(`${displayCcy}${accountCcy}`).then((i) => {
          if (cancelled) return;
          if (i != null && i !== 0) { setRate(1 / i); setAvailable(true); }
          else { setRate(null); setAvailable(false); }
        });
      });
    }, 30_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [accountCcy, displayCcy]);

  return { rate, available, loading };
}

/* ─────────── Top account bar ─────────── */

function StatusDot() {
  const status = useMarketStatus();
  const tone =
    status === "live_stream" || status === "live_polling"
      ? "bg-[hsl(var(--success,150_60%_45%))]"
      : status === "rate_limited" || status === "stale"
        ? "bg-yellow-400"
        : "bg-red-500";
  const label =
    status === "live_stream" ? "En vivo (stream)"
      : status === "live_polling" ? "En vivo"
      : status === "rate_limited" ? "Reconectando…"
      : status === "stale" ? "Datos atrasados"
      : "Sin conexión";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full animate-pulse", tone)} />
          <span className="hidden sm:inline">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, value, valueClass, tooltip }: { label: string; value: ReactNode; valueClass?: string; tooltip?: string }) {
  const body = (
    <div className="flex flex-col leading-tight px-3 py-1 min-w-[88px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-sm font-semibold", valueClass)}>{value}</span>
    </div>
  );
  if (!tooltip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function TopAccountBar({
  oneClick,
  setOneClick,
}: {
  oneClick: boolean;
  setOneClick: (v: boolean) => void;
}) {
  // ATOMIC snapshot: all six values come from a single get-mt5-terminal-data
  // response so Equidad == Balance + P&L (modulo broker swap/commission) and
  // Margen reflects the same instant. See useTerminalProAccountSnapshot.
  const { snapshot, loading, connected } = useTerminalProAccountSnapshot();
  const accountCcy = snapshot?.currency || "USD";
  const [displayCcy, setDisplayCcy] = useState<Ccy>(() => {
    try { return localStorage.getItem(DISPLAY_CCY_KEY) || accountCcy; }
    catch { return accountCcy; }
  });
  useEffect(() => {
    try { localStorage.setItem(DISPLAY_CCY_KEY, displayCcy); } catch { /* ignore */ }
  }, [displayCcy]);

  const { rate, available, loading: rateLoading } =
    useConversionRate(accountCcy, displayCcy);

  const isConverted = displayCcy !== accountCcy && rate != null && available;
  const fmt = (n: number | null | undefined) => {
    if (n == null || Number.isNaN(n)) return "—";
    if (isConverted) return fmtMoney(n * (rate ?? 1), displayCcy);
    return fmtMoney(n, accountCcy);
  };

  const profit = snapshot?.profit ?? null;
  const profitClass =
    profit != null && profit > 0 ? "text-[#17C784]" : profit != null && profit < 0 ? "text-[#F04E4E]" : "";

  return (
    <div className="flex items-center gap-1 border-b border-border bg-[#0A0A0B] px-2 py-1.5 overflow-x-auto">
      {loading && !snapshot ? (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando cuenta…
        </div>
      ) : !snapshot || !connected ? (
        <div className="px-3 py-1 text-xs text-muted-foreground">
          Sin cuenta MT conectada. Ve a <span className="text-primary">Conectar MT</span>.
        </div>
      ) : (
        <>
          <Stat label="Balance" value={fmt(snapshot.balance)} />
          <Stat label="Equidad" value={fmt(snapshot.equity)} />
          <Stat label="P&L abierto" value={fmt(profit)} valueClass={profitClass} />
        </>
      )}


      <div className="ml-auto flex items-center gap-3 pr-1">
        {/* Display-currency dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-mono">
              {displayCcy}
              {isConverted && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 rounded bg-yellow-500/15 px-1 text-[9px] uppercase text-yellow-400">
                      indicativo
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    La cuenta está denominada en {accountCcy}. Los valores en {displayCcy} son una conversión indicativa usando el cross del bróker.
                  </TooltipContent>
                </Tooltip>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDisplayCcy(accountCcy)}>
              {accountCcy} <span className="ml-2 text-xs text-muted-foreground">cuenta</span>
            </DropdownMenuItem>
            {SUPPORTED_DISPLAY_CCY.filter((c) => c !== accountCcy).map((c) => (
              <CurrencyMenuItem key={c} ccy={c} accountCcy={accountCcy} onPick={setDisplayCcy} />
            ))}
            {rateLoading && (
              <div className="px-2 py-1 text-[10px] text-muted-foreground">Verificando crosses…</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* One-click trading toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOneClick(!oneClick)}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition",
                oneClick
                  ? "border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05]"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {oneClick ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
              <span className="hidden md:inline">1-click</span>
              <Switch checked={oneClick} className="pointer-events-none scale-75" />
              {oneClick && (
                <span className="ml-1 rounded bg-[#FFCD05]/20 px-1 text-[9px] uppercase font-bold text-[#FFCD05] animate-pulse">
                  activo
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            {oneClick
              ? "Operación con un clic activada — los botones de compra/venta en el gráfico ejecutan al instante."
              : "Operación con un clic desactivada — cada acción pedirá confirmación."}
          </TooltipContent>
        </Tooltip>

        <StatusDot />
      </div>
    </div>
  );
}

/** Independent menu item that probes whether a cross is available before
 *  letting the user pick it — keeps unsupported currencies out of selection. */
function CurrencyMenuItem({
  ccy, accountCcy, onPick,
}: { ccy: Ccy; accountCcy: string; onPick: (c: Ccy) => void }) {
  const { available, loading } = useConversionRate(accountCcy, ccy);
  if (loading) {
    return <DropdownMenuItem disabled>{ccy} <Loader2 className="ml-2 h-3 w-3 animate-spin" /></DropdownMenuItem>;
  }
  if (!available) return null;
  return <DropdownMenuItem onClick={() => onPick(ccy)}>{ccy} <span className="ml-2 text-[10px] text-muted-foreground">indicativo</span></DropdownMenuItem>;
}

/* ─────────── Empty panels ─────────── */

function Panel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col bg-[#111214]">
      <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center px-4 text-xs text-muted-foreground">
        <Activity className="h-5 w-5 opacity-40" />
        <span>{hint}</span>
      </div>
    </div>
  );
}

/* ─────────── Shell ─────────── */

function Shell() {
  const [oneClick, setOneClick] = useState<boolean>(() => {
    try { return localStorage.getItem(ONE_CLICK_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(ONE_CLICK_KEY, oneClick ? "1" : "0"); } catch { /* ignore */ }
  }, [oneClick]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#050505] text-foreground">
      <TopAccountBar oneClick={oneClick} setOneClick={setOneClick} />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={18} minSize={12} collapsible>
            <TerminalWatchlist />
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={56} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={62} minSize={25}>
                <Panel title="Gráfico" hint="Fase 4: gráfico con ejecución integrada." />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={38} minSize={20}>
                <Panel
                  title="Posiciones · Órdenes · Historial"
                  hint="Fase 5: tablas con datos reales del bróker."
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={26} minSize={18} collapsible>
            <OrderTicket oneClick={oneClick} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function TerminalPro() {
  // Hard gate — keep route invisible to members until later phases ship.
  return (
    <ProtectedRoute>
      <AdminRoute>
        <DashboardLayout>
          <ErrorBoundary scope="terminal-pro">
            <BrokerSymbolsProvider>
              <LiveAccountProvider>
                <Shell />
              </LiveAccountProvider>
            </BrokerSymbolsProvider>
          </ErrorBoundary>
        </DashboardLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}

// Avoids a lint warning when only the default route component is consumed.
export const _terminalProRouteSentinel: typeof Navigate | null = null;
