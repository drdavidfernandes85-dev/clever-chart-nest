import SEO from "@/components/SEO";
import { CheckCircle2 } from "lucide-react";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";
import ComplianceFooter from "@/components/ComplianceFooter";

const items: { label: string; done: boolean; note?: string }[] = [
  { label: "Trading Layer attribution added", done: true, note: "Header, Ideas tab, footers, modals" },
  { label: 'Signals renamed to "Ideas" in user-facing UI', done: true, note: "Nav, /ideas route, page titles" },
  { label: "Copy / Follow separated from broker branding", done: true, note: "Ideas tab clarifies third-party tooling" },
  { label: "Risk warning visible across the trading room", done: true, note: "ComplianceFooter on every dashboard page" },
  { label: "Terms & Conditions page added", done: true, note: "/terms" },
  { label: "Risk Disclosure page added", done: true, note: "/risk-disclosure" },
  { label: "First-entry disclaimer modal added", done: true, note: "Per-user localStorage ack" },
  { label: "Live execution confirmation wording added", done: true, note: "Trade panel + close-position flow" },
  { label: '"No investment advice" wording added', done: true, note: "Footer, Ideas banner, modals" },
  { label: '"No guarantee" wording added', done: true, note: "Risk Disclosure + Ideas banner" },
  { label: 'Removed "Powered by INFINOX" / broker-as-operator wording', done: true },
  { label: 'Copy / Follow checkbox required before execution', done: true, note: "CopyTradeModal acknowledgement" },
  { label: "Privacy / data note (encrypted MT5 credentials)", done: true, note: "Embedded in /terms" },
  { label: "Broker separation wording present", done: true, note: "Footer + /terms section 10 + Risk Disclosure" },
  { label: "Compliance review checklist", done: true, note: "This page" },
  { label: "Final UI scan for banned terms", done: true, note: "Removed / replaced as compliant copy" },
];

const ComplianceReview = () => {
  const done = items.filter((i) => i.done).length;

  return (
    <>
      <SEO
        title="Compliance Review"
        description="Internal compliance review checklist for the trading room."
        canonical="https://elitelivetradingroom.com/compliance-review"
      />
      <div className="container max-w-3xl py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Compliance Review
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pre-broker submission checklist.
            </p>
          </div>
          <PoweredByTradingLayer />
        </header>

        <div className="rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/40 px-4 py-3 text-sm font-semibold text-foreground">
            {done} / {items.length} items complete
          </div>
          <ul className="divide-y divide-border/30">
            {items.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3 px-4 py-3 text-sm"
              >
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    item.done ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                />
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {item.label}
                  </div>
                  {item.note && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {item.note}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ComplianceFooter />
    </>
  );
};

export default ComplianceReview;
