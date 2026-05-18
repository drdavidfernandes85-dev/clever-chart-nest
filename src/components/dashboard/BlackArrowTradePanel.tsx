import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Plug, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import { cn } from "@/lib/utils";

/**
 * BlackArrow-inspired trade panel.
 * Single compact widget with Bracket, Price, Qty, quick-qty buttons,
 * Buy/Sell action grid, Close, and a live PnL block.
 */

const QUICK_QTYS = [0.2, 0.4, 0.6];

const pickTickPrice = (tick: any, side: "buy" | "sell"): number | null => {
  if (!tick) return null;
  const bid = Number(tick.bid ?? tick.Bid ?? tick.b ?? tick.last ?? NaN);
  const ask = Number(tick.ask ?? tick.Ask ?? tick.a ?? tick.last ?? NaN);
  if (side === "buy" && Number.isFinite(ask)) return ask;
  if (side === "sell" && Number.isFinite(bid)) return bid;
  if (Number.isFinite(ask)) return ask;
  if (Number.isFinite(bid)) return bid;
  return null;
};

const fmtMoney = (n: number | null | undefined, currency = "USD") => {
  if (n === null || n === undefined || Number.isNaN(n)) return "$ 0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

interface Props {
  className?: string;
}

const BlackArrowTradePanel = ({ className }: Props) => {
  const { user } = useAuth();
  const { symbol: ctxSymbol, side, setSide } = useQuickTrade();
  const { tick, selectedSymbolValid } = useBrokerSymbols();
  const { liveAccount, positions, connected, refresh } = useLiveAccount();

  const [bracket] = useState<string>("None");
  const [qty, setQty] = useState<string>("0.20");
  const [price, setPrice] = useState<string>("");
  const [pnlMode, setPnlMode] = useState<"$" | "%">("$");
  const [submitting, setSubmitting] = useState<null | string>(null);

  const priceTouched = useRef(false);
  const liveBuy = pickTickPrice(tick, "buy");
  const liveSell = pickTickPrice(tick, "sell");
  const livePrice = side === "buy" ? liveBuy : liveSell;

  // Auto-fill price input with live price when user hasn't typed.
  useEffect(() => {
    if (priceTouched.current) return;
    if (livePrice != null) setPrice(livePrice.toFixed(5));
  }, [livePrice]);

  // Reset touched flag when symbol changes.
  useEffect(() => {
    priceTouched.current = false;
  }, [ctxSymbol]);

  const qtyNum = Number(qty) || 0;
  const priceNum = Number(price) || livePrice || 0;
  const total = qtyNum * priceNum;

  // Positions filtered to the active symbol.
  const symbolPositions = useMemo(
    () => positions.filter((p) => (p.symbol || "").toUpperCase().includes((ctxSymbol || "").toUpperCase().replace(/\//g, ""))),
    [positions, ctxSymbol],
  );
  const openPnl = symbolPositions.reduce((s, p) => s + Number(p.profit || 0), 0);
  const totalPositionsPnl = positions.reduce((s, p) => s + Number(p.profit || 0), 0);
  const avgEntry =
    symbolPositions.length === 0
      ? 0
      : symbolPositions.reduce((s, p) => s + Number(p.entry_price || 0), 0) / symbolPositions.length;
  const symbolQty = symbolPositions.reduce((s, p) => s + Number(p.volume || 0), 0);
  const currency = liveAccount?.currency || "USD";

  const callExecute = async (body: Record<string, unknown>, label: string) => {
    setSubmitting(label);
    try {
      const { data, error } = await supabase.functions.invoke("execute-trade", { body });
      let res: any = data;
      if (error) {
        try {
          const ctx: any = (error as any)?.context;
          if (ctx?.json) res = await ctx.json();
          else if (ctx?.text) res = JSON.parse(await ctx.text());
        } catch { /* ignore */ }
        if (!res) {
          toast.error((error as any)?.message || `${label} failed`);
          return;
        }
      }
      if (res?.success === true) {
        toast.success(`${label} sent`, {
          description: res.ticket ? `Ticket #${res.ticket}` : undefined,
        });
        window.dispatchEvent(new CustomEvent("trade-executed", { detail: { symbol: ctxSymbol } }));
        window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
        refresh();
      } else {
        const msg =
          res?.retcodeDescription ||
          res?.retcode_description ||
          res?.error ||
          `${label} rejected`;
        toast.error(`${label} failed`, { description: msg });
      }
    } catch (e: any) {
      toast.error(e?.message || `${label} failed`);
    } finally {
      setSubmitting(null);
    }
  };

  const normalizedSymbol = (ctxSymbol || "").replace(/\//g, "").toUpperCase();

  const requireAuth = () => {
    if (!user) {
      toast.error("Sign in to trade");
      return false;
    }
    if (!connected) {
      toast.error("Connect your MT5 account first");
      return false;
    }
    if (selectedSymbolValid === false) {
      toast.error("Symbol not tradable on this account");
      return false;
    }
    if (!(qtyNum > 0)) {
      toast.error("Quantity must be greater than 0");
      return false;
    }
    return true;
  };

  const placeMarket = (s: "buy" | "sell") => {
    if (!requireAuth()) return;
    setSide(s);
    callExecute(
      { symbol: normalizedSymbol, side: s, volume: Number(qtyNum.toFixed(2)) },
      s === "buy" ? "Buy @ Mkt" : "Sell @ Mkt",
    );
  };

  const placePending = (s: "buy" | "sell", type: "stop" | "limit") => {
    if (!requireAuth()) return;
    if (!(priceNum > 0)) return toast.error("Set a price for the pending order");
    setSide(s);
    callExecute(
      {
        symbol: normalizedSymbol,
        side: s,
        volume: Number(qtyNum.toFixed(2)),
        type,
        entry: priceNum,
      },
      s === "buy" ? "Buy Stop" : "Sell Limit",
    );
  };

  const closeAll = async (symbolOnly: boolean) => {
    if (!requireAuth()) return;
    const targets = symbolOnly ? symbolPositions : positions;
    if (targets.length === 0) {
      toast.info("No open positions to close");
      return;
    }
    setSubmitting("Close");
    try {
      for (const p of targets) {
        const opposite: "buy" | "sell" = p.side === "buy" ? "sell" : "buy";
        await supabase.functions.invoke("execute-trade", {
          body: {
            symbol: p.symbol,
            side: opposite,
            volume: Number(Number(p.volume).toFixed(2)),
            closeTicket: p.ticket,
          },
        });
      }
      toast.success(`Closed ${targets.length} position${targets.length > 1 ? "s" : ""}`);
      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Close failed");
    } finally {
      setSubmitting(null);
    }
  };

  // ----- not connected -----
  if (connected === false) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 text-center",
          className,
        )}
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <h3 className="font-heading text-sm font-bold mb-1">MT5 account not connected</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Connect your trading account to enable order entry.
        </p>
        <Link
          to="/connect-mt"
          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Connect account
        </Link>
      </div>
    );
  }

  const Row = ({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) => (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          tone === "pos" && "text-emerald-400",
          tone === "neg" && "text-red-400",
          !tone && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );

  const ActionBtn = ({
    children,
    onClick,
    variant,
    disabled,
    loading,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant: "buy" | "sell" | "neutral" | "danger";
    disabled?: boolean;
    loading?: boolean;
  }) => {
    const styles: Record<string, string> = {
      buy: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary/40",
      sell: "bg-red-500 text-white hover:bg-red-500/90 border-red-500/40",
      neutral:
        "bg-muted/40 text-foreground hover:bg-muted/60 border-border/60",
      danger:
        "bg-red-600/90 text-white hover:bg-red-600 border-red-600/40",
    };
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !!submitting}
        className={cn(
          "h-9 rounded-md border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed",
          styles[variant],
        )}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {children}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl overflow-hidden text-foreground shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.18)]",
        className,
      )}
    >
      {/* Account header chip */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-background/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            Live
          </span>
          <span className="truncate text-xs font-medium">
            {liveAccount?.login ? `${liveAccount.login}` : "MT5"}{" "}
            <span className="text-muted-foreground">· {liveAccount?.server || "—"}</span>
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="p-3 space-y-3">
        {/* Bracket / Price / Qty */}
        <div className="space-y-1.5">
          <FieldRow label="Bracket">
            <button
              type="button"
              className="flex-1 h-7 rounded border border-border/60 bg-background/60 px-2 text-left text-[12px] flex items-center justify-between"
            >
              <span>&lt;{bracket}&gt;</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="h-7 w-7 rounded border border-border/60 bg-background/60 flex items-center justify-center hover:bg-background/80"
              aria-label="Bracket settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </FieldRow>

          <FieldRow label="Price">
            <input
              value={price}
              onChange={(e) => {
                priceTouched.current = true;
                setPrice(e.target.value);
              }}
              inputMode="decimal"
              className="flex-1 h-7 rounded border border-border/60 bg-background/60 px-2 text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </FieldRow>

          <FieldRow label="Qty">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              className="flex-1 h-7 rounded border border-border/60 bg-background/60 px-2 text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </FieldRow>
        </div>

        {/* Quick qty buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_QTYS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQty(q.toFixed(2))}
              className={cn(
                "h-7 rounded border text-[12px] font-mono tabular-nums transition-colors",
                qty === q.toFixed(2)
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/60 bg-background/60 hover:bg-background/80",
              )}
            >
              {q.toFixed(2)}
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded border border-border/60 bg-background/40 px-2 py-1.5">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="font-mono tabular-nums text-[12px]">
            {fmtMoney(total, currency)}
          </span>
        </div>

        {/* Action grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn
            variant="buy"
            onClick={() => placePending("buy", "stop")}
            loading={submitting === "Buy Stop"}
          >
            Buy Stop
          </ActionBtn>
          <ActionBtn
            variant="sell"
            onClick={() => placePending("sell", "limit")}
            loading={submitting === "Sell Limit"}
          >
            Sell Limit
          </ActionBtn>
          <ActionBtn
            variant="buy"
            onClick={() => placeMarket("buy")}
            loading={submitting === "Buy @ Mkt"}
          >
            Buy at Mkt
          </ActionBtn>
          <ActionBtn
            variant="sell"
            onClick={() => placeMarket("sell")}
            loading={submitting === "Sell @ Mkt"}
          >
            Sell at Mkt
          </ActionBtn>
          <ActionBtn
            variant="neutral"
            onClick={() => {
              setPrice("");
              priceTouched.current = false;
              toast.success("Order draft cancelled");
            }}
          >
            Cancel Ord.
          </ActionBtn>
          <ActionBtn
            variant="neutral"
            onClick={() => setSide(side === "buy" ? "sell" : "buy")}
          >
            Invert
          </ActionBtn>
        </div>

        <ActionBtn
          variant="danger"
          onClick={() => closeAll(true)}
          loading={submitting === "Close"}
        >
          Close
        </ActionBtn>
        <ActionBtn variant="danger" onClick={() => closeAll(false)}>
          Cancel Orders + Close
        </ActionBtn>

        {/* Profit and Loss */}
        <div className="rounded border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Profit and Loss
            </span>
            <div className="flex items-center rounded border border-border/60 overflow-hidden">
              {(["$", "%"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPnlMode(m)}
                  className={cn(
                    "px-2 py-0.5 text-[10px]",
                    pnlMode === m
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Row label="Qty" value={symbolQty ? symbolQty.toFixed(2) : "—"} />
          <Row
            label="Open PnL"
            value={openPnl === 0 ? "0.00" : fmtMoney(openPnl, currency)}
            tone={openPnl > 0 ? "pos" : openPnl < 0 ? "neg" : undefined}
          />
          <Row
            label="Daily PnL"
            value={fmtMoney(liveAccount?.profit ?? 0, currency)}
            tone={
              (liveAccount?.profit ?? 0) > 0
                ? "pos"
                : (liveAccount?.profit ?? 0) < 0
                  ? "neg"
                  : undefined
            }
          />
          <Row label="Avg" value={avgEntry ? avgEntry.toFixed(5) : fmtMoney(0, currency)} />
          <Row
            label="Total"
            value={fmtMoney(totalPositionsPnl, currency)}
            tone={
              totalPositionsPnl > 0 ? "pos" : totalPositionsPnl < 0 ? "neg" : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

const FieldRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center gap-2">
    <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{label}</span>
    {children}
  </div>
);

export default BlackArrowTradePanel;
