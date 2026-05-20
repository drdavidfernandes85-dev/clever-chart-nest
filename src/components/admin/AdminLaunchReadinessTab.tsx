import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

/**
 * Final Compliance Review Snapshot — Admin/Dev-only.
 * Read-only summary generated from manual code + route + journey audits.
 * Does NOT modify edge functions, MT5 logic, Trading Layer logic,
 * execution logic, risk controls, polling/caching logic, UI design or
 * navigation. This file only renders the snapshot.
 */

type Severity = "pass" | "info" | "medium" | "high" | "critical";

interface Finding {
  area: string;
  status: Severity;
  label: string;
  note?: string;
}

const SNAPSHOT_TIMESTAMP = "2026-05-20T15:30:00Z";

const findings: Finding[] = [
  // 2 — Core launch journey
  { area: "2. Core launch journey", status: "pass", label: "Home reachable, no black screen, no infinite loading" },
  { area: "2. Core launch journey", status: "pass", label: "Education reachable from nav + footer + home" },
  { area: "2. Core launch journey", status: "pass", label: "Webinars reachable" },
  { area: "2. Core launch journey", status: "pass", label: "Community / Chatroom reachable" },
  { area: "2. Core launch journey", status: "pass", label: "News & Calendar reachable, RSS cache active, calendar fallback active" },
  { area: "2. Core launch journey", status: "pass", label: "Market Ideas reachable", note: "/ideas — tabs are Market Ideas + Idea Tools" },
  { area: "2. Core launch journey", status: "pass", label: "LTR Terminal Pro reachable, gated by EligibilityGate" },
  { area: "2. Core launch journey", status: "pass", label: "FAQ, Terms, Risk Disclosure, Privacy reachable from Footer" },

  // 3 — Hidden / internal modules
  { area: "3. Hidden / internal modules", status: "pass", label: "Analytics — Internal Preview", note: "Not in nav; route accessible by direct URL for internal testing only" },
  { area: "3. Hidden / internal modules", status: "pass", label: "Leaderboard — Hidden / Internal Preview", note: "Not in nav; copy/follow CTAs neutralized; awaiting server-side aggregation + compliance approval" },
  { area: "3. Hidden / internal modules", status: "pass", label: "Video Library — Internal Preview", note: "Coming-soon gate active until 6+ published videos; not in nav" },
  { area: "3. Hidden / internal modules", status: "pass", label: "No nav exposure for not-ready modules" },

  // 4 — Compliance terminology
  { area: "4. Compliance terminology", status: "pass", label: "No 'Copy Trading' wording in visible UI" },
  { area: "4. Compliance terminology", status: "pass", label: "No 'Signals / Señales / Sinais' as a product claim" },
  { area: "4. Compliance terminology", status: "pass", label: "No 'guaranteed profits' / 'risk-free' claims" },
  { area: "4. Compliance terminology", status: "pass", label: "No 'investment advice' / 'financial advice' claims" },
  { area: "4. Compliance terminology", status: "pass", label: "No 'Broker signals' / 'INFINOX signals' / 'INFINOX copy trading' wording" },
  { area: "4. Compliance terminology", status: "info", label: "Legal clarification allowed: 'Market Ideas are not trading signals'" },

  // 5 — Ideas page
  { area: "5. Ideas page", status: "pass", label: "Tabs are Market Ideas + Idea Tools" },
  { area: "5. Ideas page", status: "pass", label: "CopyTrading component is not reachable from launch UI" },
  { area: "5. Ideas page", status: "pass", label: "copy_subscriptions insert path not exposed from launch UI" },
  { area: "5. Ideas page", status: "pass", label: "Educational disclaimer visible on /ideas" },

  // 6 — INFINOX role separation
  { area: "6. INFINOX role separation", status: "pass", label: "INFINOX positioned as broker / MT5 account / execution venue only" },
  { area: "6. INFINOX role separation", status: "pass", label: "INFINOX not presented as provider of ideas, signals, copy trading, recommendations or advice" },

  // 7 — Trading Layer attribution
  { area: "7. Trading Layer attribution", status: "pass", label: "Trading Layer disclosed as independent third-party technology provider", note: "PoweredByTradingLayer badge in terminal + footer + relevant legal areas" },

  // 8 — Execution safety
  { area: "8. Execution safety", status: "pass", label: "Open trades route through submit-best-execution-order" },
  { area: "8. Execution safety", status: "pass", label: "Close routes through close-position-controlled" },
  { area: "8. Execution safety", status: "pass", label: "SL/TP edits route through modify-position-protection" },
  { area: "8. Execution safety", status: "pass", label: "Explicit confirmation required for live actions" },
  { area: "8. Execution safety", status: "pass", label: "Backend risk checks active (_shared/risk.ts)" },
  { area: "8. Execution safety", status: "pass", label: "Kill switch active (tradingLayerControl)" },
  { area: "8. Execution safety", status: "pass", label: "Testing limits active" },
  { area: "8. Execution safety", status: "pass", label: "MT5 confirmation + reconciliation required (reconcile-execution)" },
  { area: "8. Execution safety", status: "pass", label: "No fake success states — connected requires success === true" },

  // 9 — Market Watch / symbols
  { area: "9. Market Watch / symbols", status: "pass", label: "Broker-approved symbols only via BrokerSymbolsContext + get-mt5-symbols" },
  { area: "9. Market Watch / symbols", status: "pass", label: "TradingView used for chart mapping only, never as a symbol source" },
  { area: "9. Market Watch / symbols", status: "pass", label: "Unsupported symbols cannot be traded — Order Ticket disables Buy/Sell" },
  { area: "9. Market Watch / symbols", status: "pass", label: "No fake dash / placeholder rows in Market Watch" },

  // 10 — Performance / rate limit
  { area: "10. Performance / rate limit", status: "pass", label: "Dashboard polling = 60s (120s when rate-limited)" },
  { area: "10. Performance / rate limit", status: "pass", label: "Manual refresh throttled to 15s with user feedback" },
  { area: "10. Performance / rate limit", status: "pass", label: "No overlapping get-live-account requests (inFlightRef guard)" },
  { area: "10. Performance / rate limit", status: "pass", label: "429 categorized as TL_RATE_LIMITED with retry-after honored" },
  { area: "10. Performance / rate limit", status: "pass", label: "Last-known-good fallback returned during cooldown when available" },
  { area: "10. Performance / rate limit", status: "pass", label: "Verified: no 429 during normal dashboard usage" },
  { area: "10. Performance / rate limit", status: "pass", label: "Cross-isolate Postgres cache live (tl_account_cache) — cacheStore=\"postgres\", 429 cooldown + last-known-good shared across isolates, admin-only SELECT RLS, service-role writes only" },

  // 11 — Stability
  { area: "11. Stability", status: "pass", label: "No black screens on visible launch pages" },
  { area: "11. Stability", status: "pass", label: "ErrorBoundary wraps terminal + dashboard + lazy routes" },
  { area: "11. Stability", status: "pass", label: "Timeout fallback active (12s upstream + service status cards)" },
  { area: "11. Stability", status: "pass", label: "No infinite loading on visible pages — Suspense + RouteOverlayLoader fallbacks" },

  // 12 — Languages
  { area: "12. Languages", status: "pass", label: "EN / ES / PT-BR available via LanguageSwitcher" },
  { area: "12. Languages", status: "pass", label: "Critical legal & risk pages translated (Terms, Risk Disclosure, Privacy, Compliance footer)" },
  { area: "12. Languages", status: "pass", label: "No mixed-language strings detected on core UI in audit" },
];

const severityMeta: Record<Severity, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pass: { label: "Pass", cls: "text-emerald-500", icon: CheckCircle2 },
  info: { label: "Info", cls: "text-sky-400", icon: Info },
  medium: { label: "Medium", cls: "text-amber-400", icon: AlertTriangle },
  high: { label: "High", cls: "text-orange-500", icon: AlertTriangle },
  critical: { label: "Critical", cls: "text-destructive", icon: XCircle },
};

const AdminLaunchReadinessTab = () => {
  const counts = findings.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<Severity, number>,
  );

  const grouped = findings.reduce((acc, f) => {
    (acc[f.area] ||= []).push(f);
    return acc;
  }, {} as Record<string, Finding[]>);

  const criticals = counts.critical ?? 0;
  const highs = counts.high ?? 0;
  const mediums = counts.medium ?? 0;
  const lows = counts.info ?? 0;
  const readyForCompliance = criticals === 0 && highs === 0;

  return (
    <div className="space-y-4">
      {/* 1 — Overall status */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Final Compliance Review Snapshot</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Read-only audit. Edge functions, MT5 logic, Trading Layer logic, execution logic, risk controls, polling/caching logic, UI design and navigation were not modified.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Snapshot timestamp: <span className="text-foreground font-mono">{SNAPSHOT_TIMESTAMP}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(severityMeta) as Severity[]).map((s) => {
              const meta = severityMeta[s];
              const Icon = meta.icon;
              return (
                <Badge key={s} variant="outline" className="gap-1.5">
                  <Icon className={`h-3 w-3 ${meta.cls}`} />
                  <span className="text-[11px]">{meta.label}: {counts[s] ?? 0}</span>
                </Badge>
              );
            })}
          </div>
        </div>
      </Card>

      <Card
        className={`p-4 ${
          readyForCompliance
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-orange-500/30 bg-orange-500/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {readyForCompliance ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Ready for Compliance Review: {readyForCompliance ? "Yes" : "No"}
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>Critical issues: <span className="text-foreground font-medium">{criticals}</span></li>
              <li>High issues: <span className="text-foreground font-medium">{highs}</span></li>
              <li>Medium issues: <span className="text-foreground font-medium">{mediums}</span></li>
              <li>Low / Info items: <span className="text-foreground font-medium">{lows}</span></li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              {readyForCompliance
                ? "No Critical or High issues. All blocking compliance items resolved."
                : `${criticals} critical and ${highs} high issues must be addressed before submission.`}
            </p>
          </div>
        </div>
      </Card>

      {Object.entries(grouped).map(([area, items]) => (
        <Card key={area} className="p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">{area}</h4>
          <ul className="divide-y divide-border/30">
            {items.map((item, idx) => {
              const meta = severityMeta[item.status];
              const Icon = meta.icon;
              return (
                <li key={idx} className="flex items-start gap-3 py-2.5">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.cls}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{item.label}</p>
                    {item.note && (
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{item.note}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {meta.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {/* 13 — Final verdict + post-review notes */}
      <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
        <h4 className="text-sm font-semibold text-foreground mb-2">
          13. Final verdict — Ready for Compliance Review: {readyForCompliance ? "Yes" : "No"}
        </h4>
        <p className="text-xs text-muted-foreground mb-2">Post-review hardening notes (non-blocking):</p>
        <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
          <li>Consider Postgres / KV cross-isolate cache for Trading Layer last-known-good data (current cache is module-scoped per Deno isolate).</li>
          <li>Restore Video Library nav only after 6+ videos are seeded.</li>
          <li>Restore Analytics only after enough user data and improved value delivery.</li>
          <li>Rework Leaderboard with server-side aggregation and compliance approval before public restore.</li>
        </ol>
      </Card>
    </div>
  );
};

export default AdminLaunchReadinessTab;
