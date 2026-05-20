import { Link } from "react-router-dom";
import {
  Smartphone,
  Monitor,
  Plug,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Activity,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import {
  LiveAccountProvider,
  useLiveAccount,
  fmtMoney,
} from "@/contexts/LiveAccountContext";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * LTR Terminal Pro — Mobile-safe summary view (Option A).
 *
 * Rendered in place of the full pro terminal whenever the viewport is
 * < 768px. Read-only. No order ticket, no chart, no execution surface —
 * those remain desktop/tablet-only by design for trader safety.
 *
 * Uses existing hooks/contexts only — no new data paths, no changes to
 * execution, risk, reconciliation, or MT5 logic.
 */
const SummaryInner = () => {
  const { t } = useLanguage();
  const { liveAccount, positions, connected, refreshing, refresh } =
    useLiveAccount();

  const c = liveAccount?.currency ?? "USD";
  const pnl = liveAccount?.profit ?? null;
  const totalPositions = positions?.length ?? 0;

  return (
    <div
      className="min-h-dvh bg-background px-3 pt-16 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4"
    >
      <SEO
        title="LTR Terminal Pro — Mobile Summary"
        description="Mobile-safe view of your LTR Terminal Pro account. Open the full terminal on desktop or tablet for charting and execution."
      />

      {/* Header */}
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-base font-bold text-foreground leading-tight">
              LTR Terminal Pro
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Mobile summary view
            </p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            aria-label="Refresh account"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Desktop recommendation banner */}
        <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Monitor className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                Best experienced on desktop or tablet
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                For the safest trading experience — full charting, order ticket
                and position management — open LTR Terminal Pro on a larger
                screen.
              </p>
            </div>
          </div>
        </div>

        {/* Account status */}
        <section
          className="mb-3 rounded-2xl border border-border/50 bg-card p-4"
          aria-labelledby="mobile-account-title"
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              id="mobile-account-title"
              className="font-heading text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              Account
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                connected
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {connected ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Live
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3" /> Not connected
                </>
              )}
            </span>
          </div>

          {liveAccount ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Login" value={`#${liveAccount.login ?? "—"}`} />
              <Stat label="Server" value={liveAccount.server || "—"} truncate />
              <Stat
                label="Balance"
                value={fmtMoney(liveAccount.balance, c)}
              />
              <Stat
                label="Equity"
                value={fmtMoney(liveAccount.equity, c)}
                tone="primary"
              />
              <Stat
                label="Floating P&L"
                value={fmtMoney(pnl, c)}
                tone={pnl == null ? "default" : pnl >= 0 ? "positive" : "negative"}
              />
              <Stat
                label="Free Margin"
                value={fmtMoney(liveAccount.marginFree, c)}
                tone="positive"
              />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                No MT5 account connected.
              </p>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/connect-mt">
                  <Plug className="h-3.5 w-3.5 mr-1.5" /> Connect MT5 Account
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* Positions summary */}
        <section
          className="mb-3 rounded-2xl border border-border/50 bg-card p-4"
          aria-labelledby="mobile-positions-title"
        >
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-primary" />
            <h2
              id="mobile-positions-title"
              className="font-heading text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              Open Positions
            </h2>
            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-2 text-[10px] font-bold tabular-nums text-foreground">
              {totalPositions}
            </span>
          </div>

          {totalPositions === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No open positions.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {positions.slice(0, 8).map((p) => {
                const profit = Number(p.profit) || 0;
                const positive = profit >= 0;
                return (
                  <li
                    key={p.ticket}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-semibold text-foreground truncate">
                        {p.symbol}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        {p.side?.toUpperCase()} · {p.volume} lots
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                        positive ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {fmtMoney(profit, c)}
                    </span>
                  </li>
                );
              })}
              {totalPositions > 8 && (
                <li className="pt-2 text-[11px] text-muted-foreground text-center">
                  +{totalPositions - 8} more — view on desktop
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Quick actions */}
        <section className="space-y-2" aria-label="Quick actions">
          <Button asChild className="w-full justify-between rounded-xl h-12 text-sm font-semibold">
            <Link to="/chatroom">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Continue to Trading Room
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-sm">
            <Link to="/ideas">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Review Market Ideas
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {!liveAccount && (
            <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-sm">
              <Link to="/connect-mt">
                <span className="flex items-center gap-2">
                  <Plug className="h-4 w-4" /> Connect MT5 Account
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </section>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground text-center">
          Educational tools and market ideas are provided for informational
          purposes only and do not constitute investment advice. Users are
          solely responsible for all trading decisions.
        </p>
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone = "default",
  truncate = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "primary";
  truncate?: boolean;
}) => (
  <div className="min-w-0">
    <p className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <p
      className={`font-mono text-sm font-bold tabular-nums ${truncate ? "truncate" : ""} ${
        tone === "positive"
          ? "text-emerald-400"
          : tone === "negative"
            ? "text-red-400"
            : tone === "primary"
              ? "text-primary"
              : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

const MobileTerminalSummary = () => (
  <LiveAccountProvider>
    <SummaryInner />
  </LiveAccountProvider>
);

export default MobileTerminalSummary;
