import { lazy, Suspense, useState } from "react";
import SEO from "@/components/SEO";
import { Lightbulb, Users, Info } from "lucide-react";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";
import ComplianceFooter from "@/components/ComplianceFooter";
import { useLanguage } from "@/i18n/LanguageContext";

const TradingSignals = lazy(() => import("@/pages/TradingSignals"));
const CopyTrading = lazy(() => import("@/pages/CopyTrading"));

type Tab = "ideas" | "follow";

const Ideas = () => {
  const [tab, setTab] = useState<Tab>("ideas");
  const { t } = useLanguage();

  return (
    <>
      <SEO
        title={t("ideas.seo.title" as never)}
        description={t("ideas.seo.desc" as never)}
        keywords={t("ideas.seo.keywords" as never)}
        canonical="https://ixsalatrading.com/ideas"
      />


      <div className="container max-w-7xl py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Ideas
              </h1>
              <PoweredByTradingLayer />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Educational market ideas and optional user-controlled review tools.
            </p>
          </div>
        </div>

        {/* Top-of-tab compliance disclaimer */}
        <div
          role="note"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1.5">
            <p>
              <strong className="font-semibold text-foreground">
                Trade Ideas are provided for educational and informational
                purposes only.
              </strong>{" "}
              They are not investment advice, financial advice, or personal
              recommendations.
            </p>
            <p>
              Any decision to follow, copy, modify, or execute an idea is made
              solely by the user. Past performance does not guarantee future
              results. Trade Ideas and related technology are powered by
              Trading Layer.
            </p>
          </div>
        </div>

        {/* Section tabs */}
        <div
          role="tablist"
          aria-label="Ideas sections"
          className="mt-5 inline-flex rounded-xl border border-border/60 bg-card p-1"
        >
          <button
            role="tab"
            aria-selected={tab === "ideas"}
            onClick={() => setTab("ideas")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "ideas"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Market Ideas
          </button>
          <button
            role="tab"
            aria-selected={tab === "follow"}
            onClick={() => setTab("follow")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "follow"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Follow / Copy Tools
          </button>
        </div>

        {/* Compliance bullets */}
        <ul className="mt-4 grid gap-1.5 text-[11px] text-muted-foreground/80 sm:grid-cols-2">
          <li>· Trade Ideas are educational and informational only.</li>
          <li>· Following or copying an idea is optional and user-controlled.</li>
          <li>· You remain responsible for every order submitted to your MT5 account.</li>
          <li>· No trade idea is investment advice or a guarantee of performance.</li>
        </ul>

        <div className="mt-4">
          <Suspense
            fallback={
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            }
          >
            {tab === "ideas" ? <TradingSignals /> : <CopyTrading />}
          </Suspense>
        </div>
      </div>

      <ComplianceFooter />
    </>
  );
};

export default Ideas;
