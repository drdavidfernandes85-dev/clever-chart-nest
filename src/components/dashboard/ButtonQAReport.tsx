/**
 * Button QA Report — Dev/Admin only.
 *
 * Static audit summary of every interactive control in the LTR Terminal Pro.
 * This is not a runtime probe; it documents the verified wiring from the
 * code audit so admins can see at a glance which buttons are live, which
 * are intentionally disabled, and which are gated by risk/MT5 state.
 *
 * Update this file whenever a new button or tab is added to the terminal.
 */
import { CheckCircle2, MinusCircle, ShieldAlert, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevMode } from "@/hooks/useDevMode";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Status = "ok" | "gated" | "disabled" | "missing";

interface Row {
  area: string;
  control: string;
  status: Status;
  detail: string;
}

const ROWS: Row[] = [
  // ───── Header ─────
  { area: "Header", control: "Refresh account", status: "ok", detail: "useLiveAccount.refresh() · disabled while refreshing" },
  { area: "Header", control: "Notification bell", status: "ok", detail: "Opens drawer · markAllRead / clearAll / per-item markRead" },
  { area: "Header", control: "Language switcher (EN/ES/PT)", status: "ok", detail: "DropdownMenu → setLocale, rehydrates all t() labels" },
  { area: "Header", control: "Profile link", status: "ok", detail: "Routes to /profile" },
  { area: "Header", control: "Connect MT5 link", status: "gated", detail: "Shown only when no live account is connected" },

  // ───── Market Watch (left rail) ─────
  { area: "Market Watch", control: "Symbol search", status: "ok", detail: "Filters live + empty-state message when no matches" },
  { area: "Market Watch", control: "Category tabs (All/Forex/Commodities/Indices/Crypto)", status: "ok", detail: "setTab(); grouped section headers in All view" },
  { area: "Market Watch", control: "Symbol row click", status: "ok", detail: "selectSymbol() syncs chart, ticket, ChartBidAskHeader, BidAskBoard" },
  { area: "Market Watch", control: "Favorite star", status: "ok", detail: "useFavorites().toggle() · persisted server-side" },
  { area: "Market Watch", control: "Empty/loading states", status: "ok", detail: "Skeleton loader, 'No matches', 'No favorites yet' all rendered" },

  // ───── Chart header ─────
  { area: "Chart", control: "Timeframe (1M/5M/15M/1H/4H/1D)", status: "ok", detail: "setInterval() remounts TradingView iframe with new resolution" },
  { area: "Chart", control: "TradingView indicators / drawing tools", status: "ok", detail: "Native TV iframe (hideSideToolbar=false, withDateRanges, saveImage)" },
  { area: "Chart", control: "Save image (screenshot)", status: "ok", detail: "Enabled via iframe saveImage prop · TV-native menu" },

  // ───── Order Ticket (right rail) ─────
  { area: "Order Ticket", control: "Symbol selector", status: "ok", detail: "Searchable dropdown · syncs back to active via QuickTrade context" },
  { area: "Order Ticket", control: "Type (Market/Limit/Stop)", status: "ok", detail: "Toggles price-input disabled state for Market" },
  { area: "Order Ticket", control: "Lots input + presets", status: "gated", detail: "Validated against volumeMin/Max + max_order_volume + testing cap" },
  { area: "Order Ticket", control: "Stop Loss / Take Profit", status: "ok", detail: "Inputs + 10/20/50p, 20/40/100p presets · No SL/TP checkbox" },
  { area: "Order Ticket", control: "BUY @ MKT / SELL @ MKT", status: "gated", detail: "submit-best-execution-order · gated by canSubmitMarket + kill-switch + MT5" },
  { area: "Order Ticket", control: "Buy/Sell Stop & Limit", status: "disabled", detail: "pendingDisabled=true — pending orders not supported by backend yet" },
  { area: "Order Ticket", control: "Cancel chip", status: "ok", detail: "Disabled when no SL/TP/price staged · clears form only" },
  { area: "Order Ticket", control: "Invert chip", status: "ok", detail: "Flips side without sending order" },
  { area: "Order Ticket", control: "Close chip", status: "gated", detail: "Disabled when symbolPositions.length === 0 · calls closeSymbolPositions()" },
  { area: "Order Ticket", control: "Close+Cxl chip", status: "gated", detail: "Disabled when nothing to close AND nothing staged" },

  // ───── Secondary tabs (right rail) ─────
  { area: "Right rail tabs", control: "Quotes tab", status: "ok", detail: "BidAskBoard rows click → selectSymbol()" },
  { area: "Right rail tabs", control: "Risk tab", status: "gated", detail: "RiskControlsPanel shown only to admin/devMode; Save/Discard/Reset wired" },
  { area: "Right rail tabs", control: "System tab", status: "ok", detail: "LiveExecutionBanner + SystemHealthWidget (read-only)" },

  // ───── Bottom blotter ─────
  { area: "Blotter", control: "Positions › Refresh", status: "ok", detail: "OpenPositionsPanel.refresh() · spinner while pending" },
  { area: "Blotter", control: "Positions › SL/TP", status: "gated", detail: "PositionActions → modify-position-protection (after confirm)" },
  { area: "Blotter", control: "Positions › Partial", status: "gated", detail: "PartialDialog → close-position-controlled · capped by testing limit" },
  { area: "Blotter", control: "Positions › Close", status: "gated", detail: "FullCloseDialog → close-position-controlled · reconcileAfterClose" },
  { area: "Blotter", control: "Orders tab", status: "disabled", detail: "Empty by design — pending order flow not yet enabled" },
  { area: "Blotter", control: "Execution Log", status: "ok", detail: "Live read-only stream" },
  { area: "Blotter", control: "Execution History › Reset / Export CSV / Detail", status: "ok", detail: "Export disabled when filtered list empty" },
  { area: "Blotter", control: "Best Execution › Refresh / Expand row", status: "ok", detail: "load() + per-row expand toggle" },
  { area: "Blotter", control: "Account tab", status: "ok", detail: "Read-only snapshot · empty state when MT5 disconnected" },
  { area: "Blotter", control: "Journal › Add / Save / Cancel / Delete", status: "ok", detail: "TradeJournal CRUD with confirm" },

  // ───── Status bar ─────
  { area: "Status bar", control: "Connection / symbol / tick / server time", status: "ok", detail: "Read-only telemetry — no buttons" },
];

const STATUS_META: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", Icon: CheckCircle2 },
  gated: { label: "Gated", cls: "text-[#FFCD05] border-[#FFCD05]/30 bg-[#FFCD05]/10", Icon: ShieldAlert },
  disabled: { label: "Disabled", cls: "text-neutral-400 border-neutral-700 bg-neutral-900/60", Icon: MinusCircle },
  missing: { label: "Missing", cls: "text-red-400 border-red-500/40 bg-red-500/10", Icon: AlertTriangle },
};

export default function ButtonQAReport() {
  const { devMode } = useDevMode();
  const { isAdmin } = useIsAdmin();

  if (!devMode && !isAdmin) return null;

  const counts = ROWS.reduce<Record<Status, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    { ok: 0, gated: 0, disabled: 0, missing: 0 },
  );

  return (
    <section
      aria-label="Button QA Report (Dev/Admin)"
      className="rounded-md border border-[color:var(--ltr-gold-border)]/60 bg-[color:var(--ltr-panel-elev)]/70 overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[color:var(--ltr-gold-border)]/60 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-[#FFCD05]" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ltr-silver-200">
            Button QA · {ROWS.length} controls
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(STATUS_META) as Status[]).map((s) => {
            const { label, cls } = STATUS_META[s];
            return (
              <span
                key={s}
                className={cn("rounded-sm border px-1.5 py-0.5 text-[9px] font-mono tabular-nums", cls)}
                title={`${label}: ${counts[s]}`}
              >
                {label} {counts[s]}
              </span>
            );
          })}
        </div>
      </header>
      <div className="max-h-[260px] overflow-y-auto divide-y divide-neutral-900/70">
        {ROWS.map((r, i) => {
          const meta = STATUS_META[r.status];
          const Icon = meta.Icon;
          return (
            <div
              key={`${r.area}-${r.control}-${i}`}
              className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1 text-[10px]"
            >
              <span className="font-mono uppercase tracking-wider text-[9px] text-ltr-silver-500 truncate">
                {r.area}
              </span>
              <div className="min-w-0">
                <div className="text-ltr-silver-100 truncate">{r.control}</div>
                <div className="text-[9px] text-ltr-silver-500 truncate" title={r.detail}>
                  {r.detail}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider",
                  meta.cls,
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
      <footer className="border-t border-[color:var(--ltr-gold-border)]/60 px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-ltr-silver-500 flex items-center justify-between">
        <span>QA snapshot · static audit</span>
        <span>{new Date().toLocaleString()}</span>
      </footer>
    </section>
  );
}
