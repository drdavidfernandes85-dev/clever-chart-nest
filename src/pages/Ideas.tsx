import { lazy, Suspense, useState } from "react";
import SEO from "@/components/SEO";
import { Lightbulb, Wrench, Info } from "lucide-react";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";

import { useLanguage } from "@/i18n/LanguageContext";

const TradingSignals = lazy(() => import("@/pages/TradingSignals"));

type Tab = "ideas" | "tools";

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

        {/* Top-of-page compliance disclaimer */}
        <div
          role="note"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1.5">
            <p>
              <strong className="font-semibold text-foreground">
                Market Ideas and related tools are provided for educational and
                informational purposes only.
              </strong>{" "}
              They are not investment advice, financial advice, trading
              signals, or personal recommendations.
            </p>
            <p>
              Users remain solely responsible for any trading decision. Past
              performance does not guarantee future results. Market Ideas and
              related technology are powered by Trading Layer.
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
            aria-selected={tab === "tools"}
            onClick={() => setTab("tools")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "tools"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="h-4 w-4" />
            Idea Tools
          </button>
        </div>

        {/* Compliance bullets */}
        <ul className="mt-4 grid gap-1.5 text-[11px] text-muted-foreground/80 sm:grid-cols-2">
          <li>· Market Ideas are educational and informational only.</li>
          <li>· Reviewing an idea is optional and entirely user-controlled.</li>
          <li>· You remain responsible for every order submitted to your MT5 account.</li>
          <li>· No Market Idea is investment advice or a guarantee of performance.</li>
        </ul>

        <div className="mt-4">
          <Suspense
            fallback={
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            }
          >
            {tab === "ideas" ? <TradingSignals /> : <IdeaToolsComingSoon />}
          </Suspense>
        </div>
      </div>
    </>

  );
};

/**
 * Launch-safe placeholder for the Idea Tools tab.
 * The underlying CopyTrading workflow (auto-follow / subscription insert) is
 * intentionally hidden from end users until compliance review is complete.
 */
const IdeaToolsComingSoon = () => (
  <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
      <Wrench className="h-5 w-5" />
    </div>
    <h2 className="font-heading text-lg font-semibold text-foreground">
      Idea Tools — coming soon
    </h2>
    <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
      Educational tools for reviewing and learning from community Market Ideas
      are being prepared for launch. They are not trading signals and do not
      execute trades automatically. Users will remain in full control of any
      decision sent to their MT5 account.
    </p>
  </div>
);

export default Ideas;
