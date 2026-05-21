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

const SNAPSHOT_TIMESTAMP = "2026-05-21T22:15:00Z";

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

  // 13 — Mobile / Tablet QA
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Public website mobile status: Pass (320–414px, 768px, 1024px)" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Mobile navigation works (Navbar hamburger + MobileBottomNav on auth pages)" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Dashboard mobile status: Pass (MobileSidebarDrawer + bottom nav; sticky bars use safe-area-inset)" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Terminal mobile strategy: Option A — mobile summary view replaces full terminal < 768px" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Tablet (768–1024px): full responsive terminal layout retained" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Mobile modals: Pass — Dialog & AlertDialog primitives render as full-width bottom sheets < 640px, max-h 100dvh, internal scroll, close button always visible, footer padding respects env(safe-area-inset-bottom)" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Mobile tables: Pass — Table primitive contains horizontal scroll inside its own container (overflow-x-auto + overscroll-x-contain); no page-level horizontal scroll triggered" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Mobile execution safety: Pass — LiveChart route renders read-only MobileTerminalSummary < 768px; no order ticket, no Buy/Sell, no close/modify modals mounted on phones" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Page-level horizontal overflow: Pass — html, body { overflow-x: hidden } global guard active in index.css" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Dashboard cards stack vertically on mobile; bottom padding pb-[calc(5rem+env(safe-area-inset-bottom))] in DashboardLayout keeps last card clear of MobileBottomNav" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Page-level horizontal overflow: blocked globally via html/body overflow-x: hidden" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "Login / Register / Profile / Connect-MT verified usable on mobile" },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "News & Calendar / Webinars / Ideas cards stack cleanly on mobile" },
  { area: "13. Mobile / Tablet QA", status: "info", label: "Phone terminal recommendation: keep Option A (mobile summary). Full LTR Terminal Pro remains desktop/tablet-only by design — execution surface is never squeezed onto small screens." },
  { area: "13. Mobile / Tablet QA", status: "info", label: "Remaining mobile issues: none blocking. Per-feature table-to-card conversions (positions/history/best-execution) can be done page-by-page in future cosmetic passes — current containment + horizontal scroll is safe and readable." },
  { area: "13. Mobile / Tablet QA", status: "pass", label: "No execution / risk / MT5 / reconciliation / Trading Layer / market-data / symbol-source logic changed during mobile polish" },

  // 14 — Global Modal & Action Payload QA
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Modal positioning: Pass — Dialog/AlertDialog/Sheet/Drawer overlays z-[100], content z-[101] (above terminal/chart layers, sidebar and headers)" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Radix DialogPortal renders into document.body — not affected by transformed/clipped parents (chart container, sidebar, terminal grid)" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Mobile modal usability: Pass — bottom-sheet layout, max-h 100dvh, internal scroll, safe-area-inset-bottom padding, close button always reachable" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Position actions payloads: Pass — Close/Partial/Modify pass the full LivePosition object (ticket + exact broker symbol + side + volume + current_price) to close-position-controlled / modify-position-protection" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Broker suffix preserved: Pass — execution actions send position.symbol exactly as returned by MT5 (e.g. XAUUSD.M is NOT normalized to XAUUSD)" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Identifier helpers: Pass — src/lib/actionPayloads.ts exposes getPositionIdentifier / getBrokerSymbol / getRowIdentifier / validatePositionAction for reuse" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Missing identifier handling: Pass — 'Position identifier missing on this row. Refresh positions and try again.' with inline Refresh action; backend rule ticket_not_live is mapped to a clear, actionable toast" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Retry Confirmation: Pass — calls reconcile-execution only; never re-sends the order" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Generic row actions: Pass — webinar/idea/news cards disable CTAs and show 'Details coming soon' when id/slug/url is missing" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "Dev diagnostics: Pass — sanitized payload (action, resolvedIdentifier, brokerSymbol, displaySymbol, side, volume, keys) via devDiagnostics(); never exposes API keys, secrets, tokens or service-role keys" },
  { area: "14. Global Modal & Action Payload QA", status: "info", label: "Critical issues found: 0 | High: 0 | Medium: 0 | Remaining: none blocking — fix complete" },
  { area: "14. Global Modal & Action Payload QA", status: "pass", label: "No execution / risk / MT5 / reconciliation / Trading Layer / market-data / symbol-source / compliance / navigation logic changed during this pass" },

  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "WS proxy security: Pass — tl-market-data-stream is a server-side WebSocket relay; Trading Layer API key never leaves the edge function; browser only sees the Supabase URL" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "TL API key server-side only: Pass — TRADING_LAYER_API_KEY read from Deno.env inside the proxy; not echoed in logs, not returned to client" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Supabase JWT verification: Pass — proxy calls admin.auth.getUser(token) and rejects 401 on failure (verify_jwt=false in config.toml is intentional so the WS upgrade handshake passes; JWT is checked in code via ?token= query param)" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Account ownership check: Pass — proxy verifies user_mt_accounts.metaapi_account_id = accountId AND user_id = JWT.sub before opening upstream; foreign accountId returns 403" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "One centralized socket: Pass — tradingLayerMarketDataWebSocket is a singleton; duplicate connect attempts are short-circuited and flagged via duplicateSocketDetected" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Lifecycle: Pass — service starts in LiveAccountContext when metaapi_account_id resolves, stops on logout/account-change/unmount; reconnect uses exponential backoff capped at 30s" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Subscriptions: Pass — union of selected symbol + Quotes/Bid-Ask board + dashboard symbol list + favorites; no full broker-universe subscribe; resubscribe on reconnect" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Tick normalization: Pass — { brokerSymbol, displaySymbol, bid, ask, last, spread, volume, timestamp, source:'trading_layer_ws' }; non-numeric inputs collapse to null (UI renders '—'); malformedEventCount increments on bad frames" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "UI fan-out: Pass — ticks are mirrored into the existing liveMarketDataStore so Order Ticket, Bid/Ask Board, Chart header and Micro Quote Strip update with zero component changes; no widget opens its own socket" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Fallback polling: Pass — MarketDataService.canRun() skips selected_symbol and watchlist loops while fallbackPollingActive=false; when WS goes stale (>8s no tick) or disconnects, fallbackPollingActive flips true and the existing 2s selected / 10s watchlist polling resumes; last-known prices stay visible" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Stale detection: Pass — selected-symbol tick age >8s triggers wsMarketDataStatus='stale' without clearing latestTicks; UI keeps last good values" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Dev Mode diagnostics: Pass — MarketDataDiagnosticsPanel shows status, masked accountId (3…3), connected-since, last tick age, selected tick age, reconnect attempts, fallback active, malformed events, duplicate socket flag, masked WS URL, subscribed symbols, last error; no secrets, tokens, API keys or service-role keys printed" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Execution safety untouched: Pass — submit-best-execution-order / close-position-controlled / modify-position-protection / reconcile-execution all unchanged; backend still validates fresh tick before any order; frontend WS ticks remain display-only and are NEVER used as price-of-record in execution paths" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Auth method confirmed: Pass — upstream uses new WebSocket(url, ['bearer', tlApiKey]) per Trading Layer's confirmed subprotocol fallback; no 'bearer.' concatenation; no custom headers" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "mt5:market-data scope confirmed: Pass — active TRADING_LAYER key for IX Sala Trading includes mt5:market-data; key prefix validated (tl_live_/tl_test_) before upstream connect; missing key returns TL_CONFIG_MISSING" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Auth-failure mapping: Pass — upstream close codes 4401/4403/1008 map to TL_WS_AUTH_FAILED; sanitized Dev Mode message 'Confirm the API key includes mt5:market-data scope' surfaces in lastError" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Secrets exposed: No — TL key read only from Deno.env inside tl-market-data-stream; never returned to client (proxy_ready frame carries only authMethod + requiredScope); Dev Mode prints 'key status: configured' with no value; logs include only stage/errorCode/masked accountId" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "info", label: "Live tick verification: Code-verified — fan-out into liveMarketDataStore drives Order Ticket, Bid/Ask Board, Chart header and Micro Quote Strip; end-to-end live-account run requires a connected MT5 session in the preview to confirm WS LIVE + live tick age" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "pass", label: "Execution untouched: Pass — submit-best-execution-order / close-position-controlled / modify-position-protection / reconcile-execution unchanged; backend fresh-tick validation remains price-of-record; WS ticks are display-only" },
  { area: "15. WebSocket Market Data (Phase 1)", status: "info", label: "Critical issues found: 0 | High: 0 | Medium: 0 | Remaining: WS lifecycle events (TL roadmap, Phase 2)" },
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
          <li><span className="text-emerald-500 font-medium">Completed:</span> Postgres cross-isolate cache for Trading Layer last-known-good data is live and verified (tl_account_cache, cacheStore="postgres", 429 cooldown shared across isolates).</li>
          <li>Restore Video Library nav only after 6+ videos are seeded.</li>
          <li>Restore Analytics only after enough user data and improved value delivery.</li>
          <li>Rework Leaderboard with server-side aggregation and compliance approval before public restore.</li>
        </ol>
      </Card>
    </div>
  );
};

export default AdminLaunchReadinessTab;
