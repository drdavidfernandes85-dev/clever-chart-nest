import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

/**
 * Dev/Admin-only Pre-Compliance Launch Readiness QA Report.
 * Read-only, generated from a manual code+route scan.
 * Does NOT touch edge functions, Supabase logic, MT5 execution,
 * Trading Layer integration, risk controls or order routes.
 */

type Severity = "pass" | "info" | "medium" | "high" | "critical";

interface Finding {
  area: string;
  status: Severity;
  label: string;
  note?: string;
}

const findings: Finding[] = [
  // 1 — Branding
  { area: "Branding", status: "pass", label: "IX LTR PRO used as platform brand", note: "Footer, SEO, head meta" },
  { area: "Branding", status: "pass", label: "LTR Terminal Pro used only for terminal product", note: "terminal.poweredByTl, /live-chart" },
  { area: "Branding", status: "pass", label: "INFINOX referenced only as broker / MT5 venue", note: "connectMt5, footer.tech.body, FAQ a8" },
  { area: "Branding", status: "pass", label: "Trading Layer shown as independent provider", note: "footer.tech.body, home.compliance.footer (EN/ES/PT)" },
  { area: "Branding", status: "medium", label: "Admin header still uses infinoxLogo asset", note: "src/pages/Admin.tsx:116 — swap to LTR mark for internal pages" },

  // 2 — Logos
  { area: "Logos", status: "pass", label: "Favicon + apple-touch-icon present", note: "/favicon.png, /apple-touch-icon.png, pwa-512.png" },
  { area: "Logos", status: "pass", label: "OG/social image updated", note: "/og-ltr-terminal-pro.png 1200x630" },
  { area: "Logos", status: "info", label: "No broken image paths detected in scan", note: "All <img src> references resolve to existing assets" },
  { area: "Logos", status: "info", label: "Visual checks pending", note: "Stretch/crop/transparency QA requires manual visual pass on dark backgrounds" },

  // 3 — Compliance wording
  { area: "Compliance wording", status: "pass", label: "No prohibited 'signals/señales/sinais' outside legal clarifications", note: "All hits are inside 'Market Ideas are not signals' style disclosures" },
  { area: "Compliance wording", status: "pass", label: "No 'guaranteed' or 'risk-free' claims in UI", note: "Scan returned 0 hits in src/components and src/pages" },
  { area: "Compliance wording", status: "pass", label: "No 'investment advice / asesoría financiera / aconselhamento' as a claim", note: "Only appears in 'NOT investment advice' disclaimers" },
  { area: "Compliance wording", status: "high", label: "'Copy Trading' tab still rendered inside /ideas", note: "src/pages/Ideas.tsx imports CopyTrading and shows it as a tab; route /copy-trading already redirects to /ideas. Either hide the tab or rename to 'Follow Idea (educational)'." },
  { area: "Compliance wording", status: "medium", label: "User-facing 'Copy Trade' wording in components", note: "CopyTradeModal, LiveSharedSignals 'Take/Copy Trade' button copy. Reword to 'Apply Idea to Terminal' to avoid copy-trading inference." },
  { area: "Compliance wording", status: "medium", label: "FAQ a6 (ES) lists 'copy trading' in negation list", note: "Allowed (negation), but reads ambiguous — consider 'no ofrecemos servicios de copy trading'." },

  // 4 — Trading Layer disclosure
  { area: "Trading Layer disclosure", status: "pass", label: "Footer disclosure present (EN/ES/PT)", note: "footer.tech.body" },
  { area: "Trading Layer disclosure", status: "pass", label: "Terminal shows 'Powered by Trading Layer'", note: "terminal.poweredByTl" },
  { area: "Trading Layer disclosure", status: "pass", label: "Ideas page disclosure", note: "ideas.seo.disclaimer + PoweredByTradingLayer component" },
  { area: "Trading Layer disclosure", status: "pass", label: "Legal/risk pages disclose", note: "terms.seo.desc, seo.terms.description (EN/ES/PT)" },
  { area: "Trading Layer disclosure", status: "info", label: "Order/idea tools area disclosure", note: "Confirmed in CopyTradeModal + ComplianceFooter — visible on every dashboard route" },

  // 5 — INFINOX separation
  { area: "INFINOX separation", status: "pass", label: "No 'INFINOX signals' / 'INFINOX copy trading' strings", note: "0 hits across src/ and index.html" },
  { area: "INFINOX separation", status: "pass", label: "INFINOX wording limited to MT5 connection / broker / venue", note: "connectMt5.* keys, faq.a8 (ES)" },
  { area: "INFINOX separation", status: "pass", label: "FAQ explicitly states INFINOX is not the provider of ideas/tech", note: "faq.a8 (ES, EN, PT)" },

  // 6 — Public SEO
  { area: "Public SEO", status: "pass", label: "Canonical + hreflang EN/ES/PT/x-default in index.html" },
  { area: "Public SEO", status: "pass", label: "Open Graph + Twitter metadata complete with image dimensions" },
  { area: "Public SEO", status: "pass", label: "JSON-LD: EducationalOrganization, WebSite, FAQPage" },
  { area: "Public SEO", status: "medium", label: "Per-route <title>/<meta description> uniqueness", note: "SEO component is used per page — verify each public route via 'view source' before launch" },
  { area: "Public SEO", status: "info", label: "H1 / H2 hierarchy not statically verifiable", note: "Recommend running the built-in SEO scanner (Open SEO tab) for live audit" },

  // 7 — Translation
  { area: "Translation", status: "pass", label: "Dev-time missing-key audit active", note: "LanguageContext.auditMissingKeys logs gaps to console" },
  { area: "Translation", status: "pass", label: "Translation QA admin tab exists", note: "Languages icon → i18nqa tab scans src/ for hardcoded Spanish" },
  { area: "Translation", status: "pass", label: "Footer, hero, pillars, CTAs, compliance fully translated EN/ES/PT" },
  { area: "Translation", status: "medium", label: "Page-by-page visual QA pending", note: "Use Translation QA tab + switch language in header on each route" },

  // 8 — Terminal
  { area: "Terminal", status: "info", label: "Stability of MarketWatch/Bid-Ask/OrderTicket/Positions/History not modified", note: "Per directive: not touched in this pass" },
  { area: "Terminal", status: "pass", label: "Risk Controls hidden behind admin/dev gates", note: "useDevMode + AdminRoute guards" },
  { area: "Terminal", status: "pass", label: "Raw JSON gated behind Dev Mode toggle" },

  // 9 — Execution safety
  { area: "Execution safety", status: "info", label: "Confirmation modals, audit logs, kill-switch and testing limits unchanged", note: "Per directive: execution logic not modified in this pass" },

  // 10 — User journey
  { area: "User journey", status: "info", label: "Language switch EN/ES/PT verified via LanguageContext" },
  { area: "User journey", status: "info", label: "Terms (/terms) and Risk Disclosure (/risk-disclosure) routes reachable" },
  { area: "User journey", status: "info", label: "Connect MT5 reachable at /connect and /connect-mt" },
  { area: "User journey", status: "medium", label: "Live test gating", note: "Confirm 'Live Test' control requires explicit Dev Mode opt-in before launch" },

  // 11 — Mobile
  { area: "Mobile / responsive", status: "info", label: "Responsive layout requires viewport QA", note: "Test 375x812 + 414x896 — homepage, /dashboard, /live-chart" },
  { area: "Mobile / responsive", status: "info", label: "Terminal on small screens", note: "Consider a 'best viewed on desktop' notice on /live-chart below 768px" },
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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pre-Compliance Launch Readiness</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Read-only QA snapshot. Edge functions, Supabase, MT5 execution, Trading Layer integration and risk controls were not modified.
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
          <li><span className="text-orange-500 font-medium">High:</span> Remove or rename the "Copy Trading" tab inside <code>/ideas</code> (tab still renders <code>CopyTrading</code> component).</li>
          <li><span className="text-amber-400 font-medium">Medium:</span> Replace user-visible "Copy Trade" labels with "Apply Idea to Terminal" in <code>CopyTradeModal</code> and <code>LiveSharedSignals</code>.</li>
          <li><span className="text-amber-400 font-medium">Medium:</span> Swap the INFINOX wordmark in the Admin header for the IX LTR mark.</li>
          <li><span className="text-amber-400 font-medium">Medium:</span> Run the SEO tab scan and verify per-route titles/descriptions/H1.</li>
          <li><span className="text-sky-400 font-medium">Info:</span> Manual visual QA: 375/414/768/1280 widths; language switch on every public + dashboard route.</li>
        </ol>
      </Card>
    </div>
  );
};

export default AdminLaunchReadinessTab;
