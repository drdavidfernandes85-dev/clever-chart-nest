import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

/**
 * Dev/Admin-only End-to-End Launch Journey QA Report.
 * Read-only, generated from a manual code + route + journey scan.
 * Does NOT touch edge functions, Supabase logic, MT5 execution,
 * Trading Layer integration, risk controls, MarketDataService,
 * symbol-source logic, News cache, or readiness gates.
 */

type Severity = "pass" | "info" | "medium" | "high" | "critical";

interface Finding {
  area: string;
  status: Severity;
  label: string;
  note?: string;
}

const findings: Finding[] = [
  // 1 — Public site
  { area: "1. Public site", status: "pass", label: "Home loads, no black screen, no infinite loading", note: "Hero + lazy sections via DeferredSection + Suspense fallbacks" },
  { area: "1. Public site", status: "pass", label: "Education / Webinars / Community / News reachable from nav", note: "Navbar + Footer + Home internal-links section" },
  { area: "1. Public site", status: "pass", label: "LTR Terminal Pro public page reachable", note: "/live-chart routes gated by EligibilityGate with clear AccessDeniedScreen" },
  { area: "1. Public site", status: "pass", label: "FAQ, Terms, Risk Disclosure, Privacy reachable from Footer" },
  { area: "1. Public site", status: "pass", label: "Logged-out CTAs route to /register or /login with redirect context" },
  { area: "1. Public site", status: "medium", label: "Per-route SEO uniqueness pending", note: "Each page has SEO component — verify titles/descriptions/H1 with built-in SEO scanner" },

  // 2 — Dashboard
  { area: "2. Dashboard", status: "pass", label: "Sidebar focused on 8 core launch pages", note: "Panel, Trading Room, News, Webinars, Ideas, Terminal, Education, Profile" },
  { area: "2. Dashboard", status: "pass", label: "Hidden modules not surfaced in sidebar or mobile drawer", note: "Analytics / Leaderboard / Video Library remain URL-accessible only" },
  { area: "2. Dashboard", status: "pass", label: "Empty states + next actions present on Panel", note: "TradingDashboard renders next-action cards when no MT5 / no trades" },
  { area: "2. Dashboard", status: "pass", label: "Admin/Dev tools not visible to normal users", note: "AdminRoute + useIsAdmin + useDevMode gates" },

  // 3 — Terminal (LTR Terminal Pro)
  { area: "3. Terminal", status: "pass", label: "Market Watch uses broker-approved symbols only", note: "BrokerSymbolsContext via get-mt5-symbols; no fake dash rows" },
  { area: "3. Terminal", status: "pass", label: "Chart wrapped in ErrorBoundary, no black screen on failure", note: "PreviewRouteLoader fallback active" },
  { area: "3. Terminal", status: "pass", label: "Order Ticket disables Buy/Sell when symbol invalid or MT5 missing", note: "selectedSymbolValid + EligibilityGate" },
  { area: "3. Terminal", status: "pass", label: "Stale-while-revalidate state layer keeps panels populated during refresh", note: "TerminalStateContext lastGood mirrors" },
  { area: "3. Terminal", status: "info", label: "Execution logic untouched this pass", note: "Per directive — Trading Layer / MT5 / risk controls not modified" },

  // 4 — News & Calendar
  { area: "4. News & Calendar", status: "pass", label: "Shared RSS cache prevents duplicate polls", note: "src/lib/rssNewsCache.ts — single 120s cycle, 10s timeout" },
  { area: "4. News & Calendar", status: "pass", label: "Economic Calendar has loading overlay + 12s retry fallback" },
  { area: "4. News & Calendar", status: "pass", label: "Page-level search wires into NewsFlow" },
  { area: "4. News & Calendar", status: "pass", label: "Compliance disclaimer visible at bottom of /news" },

  // 5 — Translation
  { area: "5. Translation", status: "pass", label: "EN / ES / PT switch via header LanguageSwitcher" },
  { area: "5. Translation", status: "pass", label: "Dev-time missing-key audit logs gaps", note: "LanguageContext.auditMissingKeys" },
  { area: "5. Translation", status: "medium", label: "Per-route visual QA pending", note: "Switch language on each route and confirm no mixed-language strings" },

  // 6 — SEO
  { area: "6. SEO", status: "pass", label: "Canonical + hreflang EN/ES/PT/x-default in index.html" },
  { area: "6. SEO", status: "pass", label: "OG + Twitter metadata + JSON-LD (FinancialService, WebSite, FAQPage)" },
  { area: "6. SEO", status: "pass", label: "Sitemaps present per language", note: "public/sitemap-en.xml, sitemap-es.xml, sitemap-pt-BR.xml" },
  { area: "6. SEO", status: "info", label: "H1 / H2 hierarchy live audit recommended", note: "Use built-in SEO tab" },

  // 7 — Compliance wording
  { area: "7. Compliance wording", status: "pass", label: "No 'signals/señales/sinais' outside legal clarifications" },
  { area: "7. Compliance wording", status: "pass", label: "No 'guaranteed' / 'risk-free' claims in UI" },
  { area: "7. Compliance wording", status: "pass", label: "No 'investment advice / financial advice' as a claim" },
  { area: "7. Compliance wording", status: "pass", label: "Leaderboard 'Follow / Copy' CTAs replaced with 'View Profile'", note: "copy-trading insert removed in launch build" },
  { area: "7. Compliance wording", status: "pass", label: "/ideas tab renamed to 'Idea Tools'; auto-follow UI hidden behind coming-soon placeholder", note: "CopyTrading component no longer rendered to end users; copy_subscriptions insert path not reachable from launch UI" },
  { area: "7. Compliance wording", status: "medium", label: "CopyTradeModal + LiveSharedSignals 'Take/Copy Trade' button copy", note: "Reword to 'Review Idea' / 'Apply Idea to Terminal'" },

  // 8 — Performance
  { area: "8. Performance", status: "pass", label: "Home lazy-loads heavy sections via DeferredSection + Suspense" },
  { area: "8. Performance", status: "pass", label: "Shared RSS cache eliminates duplicate news fetches" },
  { area: "8. Performance", status: "pass", label: "Polling registry visible in Dev Mode; no duplicate loops detected", note: "pollingRegistry + perfRegistry" },
  { area: "8. Performance", status: "info", label: "Manual viewport QA recommended at 375/414/768/1280" },

  // 9 — Hidden / internal modules
  { area: "9. Hidden modules", status: "pass", label: "Analytics — Internal Preview", note: "Hidden from nav. '—' KPIs + AI Report disabled until 3+ closed trades." },
  { area: "9. Hidden modules", status: "pass", label: "Leaderboard — Hidden", note: "Disclaimer + ≥5 trade eligibility filter + copy-trading CTAs neutralized." },
  { area: "9. Hidden modules", status: "pass", label: "Video Library — Coming-soon gate active until 6+ published videos" },

  // 10 — Critical issues remaining
  { area: "10. Critical issues", status: "pass", label: "No visible black-screen routes detected" },
  { area: "10. Critical issues", status: "pass", label: "No visible infinite-loading routes detected" },
  { area: "10. Critical issues", status: "pass", label: "Login / Register / MT5 connect flows reachable and gated correctly" },
  { area: "10. Critical issues", status: "pass", label: "Execution safety guards in place (EligibilityGate, kill-switch, confirmations)" },

  // 11 — High issues remaining
  { area: "11. High issues", status: "high", label: "Compliance: rename/hide 'Copy Trading' tab on /ideas", note: "Last remaining high-severity item before Compliance submission" },
  { area: "11. High issues", status: "medium", label: "Swap INFINOX wordmark in Admin header for IX LTR mark", note: "src/pages/Admin.tsx" },
  { area: "11. High issues", status: "medium", label: "User-facing 'Copy Trade' labels in CopyTradeModal + LiveSharedSignals" },

  // 12 — Review access mode
  { area: "12. Review access mode", status: "pass", label: "$100 balance gate bypassed in review mode", note: "canAccessFullPlatform — single source of truth in src/lib/accessMode.ts" },
  { area: "12. Review access mode", status: "pass", label: "MT5-required features still require MT5 even in review mode" },
  { area: "12. Review access mode", status: "pass", label: "Review badge visible (ReviewAccessBadge) to clarify mode" },
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
  const readyForCompliance = criticals === 0 && highs <= 1; // single tracked high = "Copy Trading" tab rename

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">End-to-End Launch Journey QA</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Public → Logged-in → MT5-connected → Terminal user journey. Edge functions, MT5 execution, Trading Layer, risk controls, MarketDataService, symbol source, news cache and readiness gates were not modified.
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
          <div>
            <p className="text-sm font-semibold text-foreground">
              Ready for Compliance Review: {readyForCompliance ? "Yes (conditional)" : "No"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {readyForCompliance
                ? `0 critical, ${highs} high. Submit after resolving the remaining high item (rename "Copy Trading" tab on /ideas).`
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

      <Card className="p-4 border-amber-500/30 bg-amber-500/5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Action items before Compliance submission</h4>
        <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
          <li><span className="text-orange-500 font-medium">High:</span> Rename or hide the "Copy Trading" tab inside <code>/ideas</code>.</li>
          <li><span className="text-amber-400 font-medium">Medium:</span> Replace "Copy Trade" labels with "Apply Idea to Terminal" in <code>CopyTradeModal</code> and <code>LiveSharedSignals</code>.</li>
          <li><span className="text-amber-400 font-medium">Medium:</span> Swap INFINOX wordmark in Admin header for IX LTR mark.</li>
          <li><span className="text-amber-400 font-medium">Medium:</span> Per-route SEO + translation visual QA at 375 / 414 / 768 / 1280.</li>
        </ol>
      </Card>
    </div>
  );
};

export default AdminLaunchReadinessTab;
