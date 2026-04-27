import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Rocket,
  Globe,
  CandlestickChart,
  Activity,
  ShieldCheck,
  Target,
  Sparkles,
  Video,
  ChevronRight,
  Image as ImageIcon,
  BookOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Section meta                                                       */
/* ------------------------------------------------------------------ */

type SectionId =
  | "getting-started"
  | "macro-analysis"
  | "technical-analysis"
  | "chart-patterns"
  | "risk-psychology"
  | "trading-strategies"
  | "advanced-topics"
  | "video-library";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: typeof Rocket;
  tag: string;
}[] = [
  { id: "getting-started",     label: "Getting Started",                       icon: Rocket,           tag: "Module 01" },
  { id: "macro-analysis",      label: "Macro Analysis",                         icon: Globe,            tag: "Module 02" },
  { id: "technical-analysis",  label: "Technical Analysis",                     icon: CandlestickChart, tag: "Module 03" },
  { id: "chart-patterns",      label: "Chart Patterns",                         icon: Activity,         tag: "Module 04" },
  { id: "risk-psychology",     label: "Risk Management & Trading Psychology",   icon: ShieldCheck,      tag: "Module 05" },
  { id: "trading-strategies",  label: "Trading Strategies",                     icon: Target,           tag: "Module 06" },
  { id: "advanced-topics",     label: "Advanced Topics",                        icon: Sparkles,         tag: "Module 07" },
  { id: "video-library",       label: "Webinars & Video Library (Free)",        icon: Video,            tag: "Bonus" },
];

/* ------------------------------------------------------------------ */
/*  Reusable atoms                                                     */
/* ------------------------------------------------------------------ */

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2
    id={id}
    className="font-heading text-2xl md:text-3xl font-bold text-foreground tracking-tight scroll-mt-28"
  >
    {children}
  </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-heading text-lg md:text-xl font-semibold text-foreground mt-6 mb-2">
    {children}
  </h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] leading-relaxed text-muted-foreground">{children}</p>
);

const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="space-y-1.5 text-[15px] leading-relaxed text-muted-foreground list-none pl-0">
    {children}
  </ul>
);

const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2">
    <ChevronRight className="h-4 w-4 mt-1 text-primary shrink-0" />
    <span>{children}</span>
  </li>
);

const ImageHint = ({ children }: { children: React.ReactNode }) => (
  <div className="my-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
    <ImageIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
    <p className="text-[13px] leading-relaxed text-foreground/80">
      <span className="font-semibold text-primary">Suggested image:</span> {children}
    </p>
  </div>
);

const KeyTakeaway = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent p-5">
    <div className="flex items-center gap-2 mb-2">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        Key Takeaway
      </span>
    </div>
    <p className="text-[15px] leading-relaxed text-foreground/90">{children}</p>
  </div>
);

const ArticleCard = ({
  id,
  tag,
  title,
  read,
  children,
}: {
  id: SectionId;
  tag: string;
  title: string;
  read: string;
  children: React.ReactNode;
}) => (
  <motion.article
    id={id}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.5, ease: "easeOut" }}
    className="relative overflow-hidden rounded-3xl border border-primary/15 bg-card/50 backdrop-blur-2xl shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.25)] scroll-mt-24"
  >
    {/* fiery glow */}
    <div className="pointer-events-none absolute inset-0 opacity-60">
      <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
    </div>
    <div className="relative px-6 py-8 md:px-10 md:py-12">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-proxima text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          {tag}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {read}
        </span>
      </div>
      <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-6 space-y-4 max-w-3xl">{children}</div>
    </div>
  </motion.article>
);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const Education = () => {
  const [active, setActive] = useState<SectionId>("getting-started");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll-spy active section
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id as SectionId);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    observerRef.current = obs;
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: SectionId) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Course",
      name: "IX Education Center",
      description:
        "Professional-grade trading education covering macro, technicals, patterns, risk, psychology, and advanced strategies.",
      provider: {
        "@type": "Organization",
        name: "IX Live Trading Room",
      },
    }),
    []
  );

  return (
    <>
      <SEO
        title="Education Center | IX Live Trading Room"
        description="Master the markets with structured, professional-grade trading education — macro, technicals, risk, psychology, strategies, and free webinars."
        canonical="https://www.salatradingelite.com/education"
        type="article"
        jsonLd={jsonLd}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* HERO */}
        <header className="relative overflow-hidden border-b border-primary/15">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 left-1/3 h-[480px] w-[480px] rounded-full bg-primary/15 blur-[120px]" />
            <div className="absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full bg-orange-500/10 blur-[120px]" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-3xl"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-proxima text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                <GraduationCap className="h-3.5 w-3.5" />
                Education Center
              </span>
              <h1 className="mt-4 font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                Master the markets with{" "}
                <span className="bg-gradient-to-br from-primary via-primary to-orange-400 bg-clip-text text-transparent">
                  professional-grade
                </span>{" "}
                education.
              </h1>
              <p className="mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">
                Whether you're a beginner or an experienced trader, our structured learning
                path will help you build a consistent, profitable trading career.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => scrollTo("getting-started")}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition"
                >
                  <BookOpen className="h-4 w-4" />
                  Start Learning
                </button>
                <Link
                  to="/webinars"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition"
                >
                  <Video className="h-4 w-4" />
                  Watch Live
                </Link>
              </div>
            </motion.div>
          </div>
        </header>

        {/* MAIN — sidebar + articles */}
        <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* SIDEBAR (sticky) */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-primary/15 bg-card/40 backdrop-blur-2xl p-3">
                <div className="px-2 pb-2 pt-1">
                  <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Curriculum
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {SECTIONS.map((s) => {
                    const Icon = s.icon;
                    const isActive = active === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => scrollTo(s.id)}
                          className={cn(
                            "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                            )}
                          />
                          <span className="truncate">{s.label}</span>
                          {isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(48_100%_51%)]" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>

            {/* ARTICLES */}
            <div className="space-y-10 min-w-0">
              {/* 1 — GETTING STARTED */}
              <ArticleCard
                id="getting-started"
                tag="Module 01 · Getting Started"
                title="Getting Started: Your First Steps as a Trader"
                read="6 min read"
              >
                <P>
                  Trading is a craft. Before you risk a single dollar, you need a clear roadmap,
                  the right tools, and realistic expectations. This module gives you the
                  foundation every successful trader builds on.
                </P>

                <H3>What you'll learn</H3>
                <UL>
                  <LI>How global markets work — Forex, indices, commodities, crypto</LI>
                  <LI>The difference between brokers, exchanges, and liquidity providers</LI>
                  <LI>How to read a price chart and understand bid/ask, spread, and pip value</LI>
                  <LI>How to set up your trading platform (MT4 / MT5 / TradingView)</LI>
                </UL>

                <ImageHint>"Trader's workstation with MT5 and TradingView side-by-side"</ImageHint>

                <H3>Build your trading toolkit</H3>
                <UL>
                  <LI>A stable broker with regulated execution (e.g. Infinox)</LI>
                  <LI>A charting platform with real-time data</LI>
                  <LI>An economic calendar to track high-impact events</LI>
                  <LI>A trading journal — every trade, win or loss, gets logged</LI>
                </UL>

                <KeyTakeaway>
                  You don't need 20 indicators or three monitors to start. You need a clean
                  chart, a written plan, and the discipline to follow it.
                </KeyTakeaway>
              </ArticleCard>

              {/* 2 — MACRO ANALYSIS */}
              <ArticleCard
                id="macro-analysis"
                tag="Module 02 · Macro Analysis"
                title="Macro Analysis: Reading the Global Economic Engine"
                read="14 min read"
              >
                <P>
                  Macro analysis looks at the behaviour of an economy as a whole over the
                  medium term, taking into account every force that drives its performance.
                  Each economy has its own characteristics and dynamics — shaped by monetary
                  &amp; fiscal policy, politics, technology, and law — but every economy is
                  measured with the same standardised toolkit of economic data.
                </P>
                <P>
                  When you analyse a currency pair, you're really comparing the macro
                  outlook of two countries. The same logic applies to equities, indices,
                  precious metals, and commodities — each is anchored to an underlying
                  economic story. The combination of <strong>macro analysis</strong> for
                  trade direction and <strong>technical analysis</strong> for entry &amp;
                  exit is one of the most powerful weapons in a trader's arsenal.
                </P>

                <ImageHint>
                  "Global macro dashboard — central bank rates, inflation, GDP, and risk
                  sentiment in one view"
                </ImageHint>

                <H2>1. Leading Indicators</H2>
                <P>
                  Leading indicators move <em>before</em> the broader economy does. They
                  give early warning of expansion or contraction — and that's where the
                  edge lives.
                </P>

                <H3>Payroll Data (e.g. US Non-Farm Payrolls)</H3>
                <P>
                  Collected monthly by national statistics agencies (in the US, the BLS
                  samples 400,000+ businesses to produce the headline NFP number). It's the
                  most-watched gauge of labour market health and reacts quickly to changing
                  conditions. <strong>200K+</strong> is typical of expansion; readings near
                  zero — or negative spikes — signal contraction.
                </P>

                <H3>Production Indicators</H3>
                <UL>
                  <LI>
                    <strong>Manufacturing Production</strong> — % change in inflation-adjusted
                    output by manufacturers. Positive = expansion, negative = contraction.
                  </LI>
                  <LI>
                    <strong>Industrial Production</strong> — same idea but covers the entire
                    industrial sector (manufacturers, mines, utilities).
                  </LI>
                  <LI>
                    <strong>Inventory Levels</strong> — rising inventories signal weak consumer
                    demand and a softening economy.
                  </LI>
                </UL>
                <P>
                  Production figures are highly sensitive to interest rates and consumer
                  demand, making them a useful forecast for future GDP growth and inflation.
                </P>

                <H3>Retail Sales</H3>
                <P>
                  The most reliable gauge of consumer spending — which accounts for{" "}
                  <strong>60–70% of GDP</strong> in most western economies. Few releases
                  give you a cleaner read on the real-time pulse of the economy.
                </P>

                <H3>Jobless Claims (Initial &amp; Continuing)</H3>
                <UL>
                  <LI>
                    <strong>Initial Claims</strong> — first-time filings for unemployment
                    insurance (weekly).
                  </LI>
                  <LI>
                    <strong>Continuing Claims</strong> — total ongoing recipients.
                  </LI>
                </UL>
                <P>
                  Rising claims signal a deteriorating labour force and a weakening economy.
                </P>

                <H3>Building Permits / Housing Starts</H3>
                <P>
                  Building permits track the rate of change of permits issued; housing
                  starts track new constructions underway. Construction is typically one of
                  the first sectors to enter recession when conditions deteriorate, so these
                  two are powerful early-warning indicators.
                </P>

                <H3>Purchasing Managers' Index (PMI / ISM)</H3>
                <P>
                  Purchasing managers have early access to company performance data — so
                  their activity leads the broader economy. PMIs cover Manufacturing,
                  Construction, and Services. The US ISM index is the benchmark, surveying
                  hundreds of firms across employment, production, inventories, new orders,
                  and deliveries.
                </P>
                <UL>
                  <LI><strong>50</strong> = flat</LI>
                  <LI><strong>&gt; 50</strong> = expansion</LI>
                  <LI><strong>&lt; 50</strong> = contraction</LI>
                </UL>

                <H3>House Price Index</H3>
                <P>
                  Tracks the rate of change of average home selling prices. Rising prices
                  reflect strong housing demand and broader economic strength.
                </P>

                <ImageHint>
                  "Leading indicators dashboard — NFP, PMI, Retail Sales, Jobless Claims
                  trend lines"
                </ImageHint>

                <H2>2. Lagging Indicators</H2>
                <P>
                  Lagging indicators confirm what leading indicators have already hinted at.
                  They don't predict — they verify. But they move markets all the same,
                  because central banks act on them.
                </P>

                <H3>Gross Domestic Product (GDP)</H3>
                <P>
                  GDP measures total inflation-adjusted output of goods and services. The
                  most-watched figure is the Quarter-on-Quarter change. Higher-than-expected
                  GDP is bullish for a country's currency; lower is bearish.
                </P>
                <P>
                  Two consecutive negative QoQ readings = a <strong>recession</strong>.
                </P>
                <p className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 font-mono text-[13px] italic text-foreground/85">
                  GDP = Consumption + Investment + Government Spending + (Exports − Imports)
                </p>

                <H3>Unemployment Rate</H3>
                <P>
                  The percentage of the workforce actively looking for employment. Three
                  forms to know:
                </P>
                <UL>
                  <LI>
                    <strong>Frictional</strong> — the natural floor caused by workers and
                    employers transitioning.
                  </LI>
                  <LI>
                    <strong>Structural</strong> — longer-lasting, driven by technology,
                    competition, or policy shifts.
                  </LI>
                  <LI>
                    <strong>Seasonal</strong> — driven by predictable seasonal demand swings.
                  </LI>
                </UL>
                <P>
                  Pair it with the <strong>Labour Force Participation Rate (LFPR)</strong> —
                  a healthy economy has a low unemployment rate <em>and</em> elevated LFPR.
                  A falling unemployment rate driven by a falling LFPR is a hollow win.
                </P>

                <H3>Inflation</H3>
                <P>
                  The rate of change of the general level of prices for goods and services.
                  Watch the three primary measures:
                </P>
                <UL>
                  <LI>
                    <strong>CPI (Consumer Price Index)</strong> — the global default,
                    measured from the consumer's perspective.
                  </LI>
                  <LI>
                    <strong>HICP (Harmonised Index of Consumer Prices)</strong> — the
                    European standard, tracking a common basket of goods.
                  </LI>
                  <LI>
                    <strong>PCE (Personal Consumption Expenditures)</strong> — the Federal
                    Reserve's preferred measure.
                  </LI>
                </UL>

                <H3>Wage Growth</H3>
                <P>
                  Tracked both nominal and inflation-adjusted. Wages drive disposable
                  income — and according to the Phillips curve, they're the number-one
                  cause of inflation. Critical for gauging future central bank moves.
                </P>

                <H3>Interest Rates</H3>
                <P>
                  The central bank's primary tool — the rate at which it lends to domestic
                  banks (Fed Funds Rate in the US, Base Rate in the UK, Refi Rate in the
                  Eurozone).
                </P>
                <UL>
                  <LI>
                    <strong>Cuts</strong> reduce incentive to save → encourage spending and
                    risk-taking → stimulate the economy.
                  </LI>
                  <LI>
                    <strong>Hikes</strong> raise the cost of borrowing → reduce risk-taking →
                    cool the economy.
                  </LI>
                </UL>
                <P>
                  Central bank rate decisions are the most-watched events on the global
                  calendar — and forward guidance often matters more than the decision itself.
                </P>

                <H3>Consumer Confidence Index</H3>
                <P>
                  A survey-based measure of how consumers feel about economic prospects.
                  High readings = increased propensity to spend; low readings = pulling back.
                  An excellent leading signal of future consumption.
                </P>

                <H3>Durable Goods Orders</H3>
                <P>
                  New orders for goods built to last 3+ years — cars, electronics, furniture,
                  appliances. Released monthly in two parts (advance and shipments). A leading
                  indicator of business and consumer confidence in long-term commitments.
                </P>

                <H3>Government Balances</H3>
                <UL>
                  <LI>
                    <strong>Budget Balance</strong> — revenue minus expenditures. Persistent
                    deficits drive up government debt.
                  </LI>
                  <LI>
                    <strong>Current Account Balance</strong> — Trade Balance + Income from
                    Abroad + Net Current Transfers. A surplus = net lender to the world; a
                    deficit = net borrower.
                  </LI>
                  <LI>
                    <strong>Trade Balance</strong> — exports minus imports. A surplus signals
                    strength and independence; a deficit signals dependence and creates
                    outflows of domestic currency.
                  </LI>
                  <LI>
                    <strong>Balance of Payments (BoP)</strong> — quarterly net flow of
                    payments in and out of the country. A persistent BoP deficit shrinks
                    international reserves and forces currency devaluation. A surplus does
                    the opposite.
                  </LI>
                </UL>

                <ImageHint>
                  "Balance of Payments effect on currency supply &amp; demand curve"
                </ImageHint>

                <H2>3. The Risk-On / Risk-Off Lens</H2>
                <P>
                  Macro data shifts the global mood between two regimes. Knowing which one
                  you're in tells you which assets to favour.
                </P>
                <UL>
                  <LI>
                    <strong>Risk-on:</strong> stocks, AUD, NZD, EM currencies, crypto rally
                  </LI>
                  <LI>
                    <strong>Risk-off:</strong> USD, JPY, CHF, gold, and bonds catch a bid
                  </LI>
                </UL>

                <ImageHint>
                  "Risk-on vs risk-off asset map across Forex, indices, and metals"
                </ImageHint>

                <H2>4. Building Your Macro Bias — A Weekly Process</H2>
                <UL>
                  <LI>Every Sunday, scan the economic calendar for the week ahead</LI>
                  <LI>Identify the 1–2 highest-impact events (rate decisions, CPI, NFP, GDP)</LI>
                  <LI>
                    Map your scenarios: <em>"If CPI &gt; consensus → long USD/JPY,
                    short Gold"</em>
                  </LI>
                  <LI>Compare the macro outlook of <em>both</em> currencies in any pair</LI>
                  <LI>Wait for technicals to confirm your entry — never trade macro blind</LI>
                </UL>

                <KeyTakeaway>
                  Technicals tell you <strong>where</strong> to act. Macro tells you{" "}
                  <strong>why</strong> the market is moving. The pros use both — leading
                  indicators for the heads-up, lagging indicators for the confirmation, and
                  the chart for the trigger.
                </KeyTakeaway>
              </ArticleCard>

              {/* 3 — TECHNICAL ANALYSIS */}
              <ArticleCard
                id="technical-analysis"
                tag="Module 03 · Technical Analysis"
                title="Technical Analysis: The Language of Price"
                read="18 min read"
              >
                <P>
                  Technical analysis began with Japanese rice traders in the 17th century and
                  was formalised in the West by Charles Dow around 1900. Different origins —
                  same core principles:
                </P>
                <UL>
                  <LI>The <strong>"what"</strong> (price action) matters more than the <strong>"why"</strong> (news, earnings)</LI>
                  <LI>All known information is already reflected in the price</LI>
                  <LI>Buyers and sellers move markets through expectation, fear, and greed</LI>
                  <LI>Markets fluctuate — and the actual price may not reflect underlying value</LI>
                </UL>
                <P>
                  Technical analysis is, at its core, a study of supply and demand. The
                  presence of a pattern doesn't <em>guarantee</em> success — it skews the
                  probability slightly in your favour. Trading is a game of probabilities and
                  risk management; technical analysis is the tool that gives you the edge.
                </P>

                <H2>1. Market Regimes</H2>
                <H3>Trending Market</H3>
                <P>
                  Moves consistently in one direction over time. An <strong>uptrend</strong>{" "}
                  is a succession of higher highs and higher lows. A <strong>downtrend</strong>{" "}
                  is a succession of lower highs and lower lows.
                </P>
                <H3>Ranging Market</H3>
                <P>
                  Sideways action that repeatedly tests the same highs and lows. Support and
                  resistance levels tend to hold with high probability — and traders fade the
                  edges accordingly.
                </P>

                <ImageHint>"Side-by-side comparison: trending market vs ranging market"</ImageHint>

                <H2>2. Support, Resistance &amp; Confluence</H2>
                <UL>
                  <LI>
                    <strong>Support</strong> — a price area where buying interest is expected
                    to emerge. Can be a trendline, a Fibonacci level, or a horizontal zone.
                    Increased volume strengthens the level.
                  </LI>
                  <LI>
                    <strong>Resistance</strong> — a price area where selling interest is
                    expected to emerge. Same dynamics in reverse.
                  </LI>
                  <LI>
                    <strong>Confluence Zone</strong> — when several key levels (S/R,
                    Fibonacci, trendline) cluster in close proximity. The probability of a
                    reaction increases dramatically. <em>Confluence is where the pros wait.</em>
                  </LI>
                </UL>

                <H2>3. Fibonacci Retracements &amp; Extensions</H2>
                <P>
                  Mathematical ratios used to derive support, resistance, and projection
                  targets. They power most modern technical analysis — including Harmonic
                  patterns and Elliott Wave theory.
                </P>
                <UL>
                  <LI><strong>Retracement levels:</strong> 0%, 23.6%, 38.2%, 50%, 61.8%, 100%</LI>
                  <LI><strong>The 61.8% level</strong> is the most-watched of all</LI>
                  <LI>
                    <strong>Extensions</strong> project a move forward — used for measured
                    moves (AB = CD) and Elliott Wave projections (Wave 5 as 61.8% or 100% of
                    Wave 1)
                  </LI>
                </UL>

                <ImageHint>"Fibonacci retracement tool drawn on a clean swing on EUR/USD daily"</ImageHint>

                <H2>4. Channels &amp; Gaps</H2>
                <P>
                  A <strong>channel</strong> is a structure bounded by two parallel
                  trendlines — rising, falling, or horizontal. They define dynamic S/R and
                  let you trade the edges with discipline.
                </P>
                <P>
                  A <strong>gap</strong> is an area on the chart with no trades — usually
                  caused by news released while markets were closed, or violent intraday
                  repricing. Price often returns to "fill the gap," making them powerful
                  reference points.
                </P>
                <UL>
                  <LI>
                    <strong>Runaway gaps</strong> — strong continuation gaps, often on heavy
                    volume, signalling a real fundamental shift
                  </LI>
                  <LI>
                    <strong>Exhaustion gaps</strong> — appear at the end of prolonged moves
                    and frequently mark a reversal (peak euphoria or capitulation)
                  </LI>
                </UL>

                <H2>5. Reading Candlesticks</H2>
                <P>
                  A candlestick is a snapshot of the battle between buyers and sellers in a
                  fixed time window. The <strong>body</strong> is the open vs close; the{" "}
                  <strong>wicks</strong> mark the extremes of the fight. Green/white = close
                  above open. Red/black = close below open.
                </P>

                <ImageHint>
                  "Annotated candlestick anatomy — body, wicks, bullish vs bearish examples"
                </ImageHint>

                <H3>Single-Candle Signals</H3>
                <UL>
                  <LI>
                    <strong>Marubozu (white / black)</strong> — no wicks at all. Open = low
                    and close = high (or vice versa). The strongest single-candle bullish or
                    bearish signal.
                  </LI>
                  <LI>
                    <strong>Hammer</strong> — small body at the top, long lower wick (body{" "}
                    &lt; 50% of wick). Bullish reversal at the bottom of a downtrend.
                  </LI>
                  <LI>
                    <strong>Shooting Star</strong> — small body at the bottom, long upper
                    wick. Bearish reversal at the top of an uptrend.
                  </LI>
                  <LI>
                    <strong>Hanging Man / Inverted Hammer</strong> — visually identical to
                    hammer/shooting star but in the opposite trend context. <em>Statistically
                    less reliable</em> than tradition suggests — confirm before acting.
                  </LI>
                  <LI>
                    <strong>Doji</strong> — open = close, forming a cross. Indecision; can
                    signal reversal at extremes. Variations: <em>Dragonfly</em> (long lower
                    wick, bullish bias), <em>Gravestone</em> (long upper wick, bearish bias).
                  </LI>
                  <LI>
                    <strong>Spinning Top</strong> — small body, wicks on both sides. Pure
                    indecision; reversal candidate at structure.
                  </LI>
                </UL>

                <H3>Two-Candle Patterns</H3>
                <UL>
                  <LI>
                    <strong>Bullish Engulfing</strong> — a bullish candle fully engulfs the
                    prior bearish one. Strong reversal signal at support.
                  </LI>
                  <LI>
                    <strong>Bearish Engulfing</strong> — the mirror at resistance.
                  </LI>
                  <LI>
                    <strong>Bullish Harami</strong> — a small bullish candle inside the body
                    of a large prior bearish candle. Reversal formation.
                  </LI>
                  <LI>
                    <strong>Bearish Harami</strong> — the mirror at the top of an uptrend.
                  </LI>
                  <LI>
                    <strong>Piercing Line</strong> — bearish candle followed by a bullish one
                    that gaps down and closes above the 50% retracement of the first. Strong
                    bullish reversal.
                  </LI>
                  <LI>
                    <strong>Dark Cloud Cover</strong> — bullish candle followed by a bearish
                    one that gaps up and closes below the 50% retracement. Strong bearish
                    reversal.
                  </LI>
                  <LI>
                    <strong>Tweezer Top / Bottom</strong> — two candles that test the same
                    extreme. Reversal candidate, but less reliable than the textbooks claim —
                    use as confirmation, not standalone trigger.
                  </LI>
                  <LI>
                    <strong>Inside / Outside Candle</strong> — when one candle's range fully
                    contains (or fully covers) the prior candle's range. Colour is irrelevant.
                  </LI>
                </UL>

                <H3>Three-Candle Patterns</H3>
                <UL>
                  <LI>
                    <strong>Morning Star</strong> — large bearish → small indecision → large
                    bullish closing above the midpoint of the first. One of the most reliable
                    bullish reversal signals.
                  </LI>
                  <LI>
                    <strong>Evening Star</strong> — large bullish → small indecision → large
                    bearish closing below the midpoint of the first. The bearish mirror.
                  </LI>
                </UL>

                <ImageHint>
                  "Cheat sheet — top 12 candlestick patterns with example chart context"
                </ImageHint>

                <H2>6. Trend &amp; Moving Averages</H2>
                <P>
                  Moving averages smooth out short-term noise so you can see the bigger
                  picture. Each point is the average of the previous N periods.
                </P>
                <UL>
                  <LI><strong>Simple MA (SMA)</strong> — equal weight to every data point</LI>
                  <LI><strong>Exponential MA (EMA)</strong> — more weight to recent data</LI>
                  <LI><strong>50-day &amp; 200-day SMAs</strong> — the most-watched MAs in the world; institutional benchmarks</LI>
                  <LI>
                    <strong>Golden Cross</strong> — short-term MA crosses above long-term MA
                    (e.g. 50 above 200). Major bullish regime signal.
                  </LI>
                  <LI>
                    <strong>Death Cross</strong> — the reverse. A major bearish regime signal.
                  </LI>
                </UL>

                <H2>7. Indicators That Actually Help</H2>
                <H3>RSI (Relative Strength Index)</H3>
                <P>
                  Measures the magnitude and speed of recent moves on a 0–100 scale.
                </P>
                <p className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 font-mono text-[13px] italic text-foreground/85">
                  RSI = 100 − 100 / (1 + RS), where RS = average gains / average losses
                </p>
                <UL>
                  <LI><strong>Below 30</strong> — oversold, potential bounce</LI>
                  <LI><strong>Above 70</strong> — overbought, potential pullback</LI>
                  <LI>
                    <strong>Divergence</strong> — when price and RSI move in opposite
                    directions. Often leads the next big move (e.g. higher highs in price but
                    lower highs in RSI = warning).
                  </LI>
                </UL>

                <H3>Volume</H3>
                <P>
                  An overlooked but critical indicator. A real move is confirmed by rising
                  volume; a low-volume rally has a higher probability of failing.
                </P>
                <UL>
                  <LI>Sharp moves on high volume + short duration near extremes = exhaustion</LI>
                  <LI>Breakouts without volume = traps</LI>
                  <LI>Divergence between price and volume = early warning</LI>
                </UL>

                <H3>Other Workhorses</H3>
                <UL>
                  <LI><strong>MACD</strong> — trend confirmation via crossovers and histogram</LI>
                  <LI><strong>VWAP</strong> — the institutional mean; pullbacks to VWAP are tradable</LI>
                  <LI><strong>Volume Profile</strong> — where price has spent the most time (true value)</LI>
                </UL>

                <H2>8. Multi-Timeframe Analysis</H2>
                <P>
                  The pros zoom out before they zoom in. Define the trend on the higher
                  timeframe (Daily / 4H), then time the entry on the lower (15M / 5M).
                  Higher-timeframe context filters out 80% of bad setups.
                </P>

                <KeyTakeaway>
                  Less is more. A clean chart with structure, one moving average, one
                  momentum tool, and a trained eye for candlesticks will outperform a screen
                  full of noise — every single time.
                </KeyTakeaway>
              </ArticleCard>

              {/* 4 — CHART PATTERNS */}
              <ArticleCard
                id="chart-patterns"
                tag="Module 04 · Chart Patterns"
                title="Chart Patterns: Recurring Footprints of the Market"
                read="13 min read"
              >
                <P>
                  Chart patterns are the visible signature of crowd psychology. They form
                  because traders react the same way to the same conditions, generation after
                  generation. Spot them early and you trade with the institutions, not against
                  them.
                </P>

                <H2>1. Continuation Patterns</H2>
                <P>
                  The trend pauses, then resumes. These are the highest-probability setups in
                  trending markets.
                </P>

                <H3>Flag</H3>
                <P>
                  A short, sloping rectangle bounded by two parallel trendlines —
                  consolidation after a strong impulsive move (the "pole"). The flag itself
                  must retrace less than 50% of the pole; if it exceeds that, you're looking
                  at a channel, not a flag. Breakout typically resumes the prior trend with
                  similar magnitude.
                </P>

                <H3>Pennant</H3>
                <P>
                  An initial large move followed by consolidation between converging
                  trendlines (a small symmetrical triangle). Followed by a breakout in the
                  direction of the existing strong trend.
                </P>

                <H3>Bullish / Bearish Wedge</H3>
                <P>
                  Both trendlines converge into a triangular shape. A <strong>bullish
                  wedge</strong> shows consistent highs with higher lows. A <strong>bearish
                  wedge</strong> shows consistent lows with lower highs.
                </P>

                <H3>Ascending / Descending Triangle</H3>
                <P>
                  Pressure builds against a flat horizontal level. Ascending = flat top with
                  rising lows (bullish bias). Descending = flat bottom with lower highs
                  (bearish bias).
                </P>

                <H3>Channel</H3>
                <P>
                  Bounded by two parallel trendlines with at least 4 contact points (S and R).
                  Can be rising, falling, or horizontal. Channels often evolve into triangles
                  as traders compress within the range.
                </P>

                <ImageHint>
                  "Continuation pattern cheat sheet — flag, pennant, wedge, ascending triangle"
                </ImageHint>

                <H2>2. Reversal Patterns</H2>
                <P>The trend exhausts and flips. Powerful — but only valid at meaningful structure.</P>

                <H3>Ascending / Descending Wedge (Reversal)</H3>
                <P>
                  Also called a rising or falling wedge. Price loses momentum within the
                  wedge, leading to an explosive break and counter-trend move. Minimum
                  measured target: <strong>38.2% retracement</strong> of the previous trend.
                </P>

                <H3>Double Top / Double Bottom</H3>
                <P>
                  Two distinct, well-defined peaks (or troughs) at approximately the same
                  price level. Failed continuation — the second test fails to break, signalling
                  reversal.
                </P>

                <H3>Triple Top / Triple Bottom</H3>
                <P>
                  Three distinct peaks (or troughs) at the same level. Less common than
                  doubles but more reliable when they form — three failed attempts strongly
                  suggest reversal.
                </P>

                <H3>Head &amp; Shoulders (Regular &amp; Inverse)</H3>
                <P>
                  Three peaks: a higher middle peak (the "head") flanked by two lower peaks
                  (the "shoulders"). The textbook top reversal. Inverse H&amp;S is the mirror
                  for downtrends.
                </P>
                <UL>
                  <LI><strong>Entry:</strong> just below (or above) the neckline</LI>
                  <LI><strong>Stop:</strong> above (or below) the right shoulder</LI>
                  <LI><strong>Target:</strong> the distance from the head to the neckline, projected from the breakout</LI>
                </UL>

                <ImageHint>
                  "Head &amp; Shoulders on Gold (XAU/USD) with neckline break and target projection"
                </ImageHint>

                <H3>Cup and Handle</H3>
                <P>
                  Cup-shaped accumulation followed by a smaller "handle" pullback before the
                  breakout. The handle is always on the right side. Breakout past the neckline
                  is powerful because it triggers stops from counter-trend traders.
                </P>
                <UL>
                  <LI><strong>Entry:</strong> just beyond the neckline</LI>
                  <LI><strong>Target:</strong> distance from the extreme of the cup to the neckline (not the handle)</LI>
                </UL>

                <H2>3. Bilateral Patterns</H2>
                <P>Direction is unclear until breakout — wait for confirmation before entering.</P>
                <UL>
                  <LI><strong>Symmetrical Triangle</strong> — coiling price, explosive release</LI>
                  <LI><strong>Wedge (rising / falling)</strong> — often reversal, sometimes continuation</LI>
                  <LI><strong>Rectangle / Range</strong> — trade the edges, not the middle</LI>
                </UL>

                <H2>4. How to Trade a Pattern Correctly</H2>
                <UL>
                  <LI>Identify the pattern <em>before</em> the breakout — not after</LI>
                  <LI>Wait for a clean break + close beyond the level</LI>
                  <LI>Look for a retest of the broken level for a low-risk entry</LI>
                  <LI>Measure the pattern's height to project a realistic target</LI>
                  <LI>Place the stop on the opposite side of the pattern, not just below the candle</LI>
                  <LI>Confirm with volume — a real breakout shows expanding participation</LI>
                </UL>

                <ImageHint>"Anatomy of a textbook breakout: structure → break → retest → run"</ImageHint>

                <KeyTakeaway>
                  Patterns don't predict — they prepare. They give you a framework for{" "}
                  <em>where</em> to act and <em>where</em> you're wrong. The edge is in
                  execution, not in the pattern itself.
                </KeyTakeaway>
              </ArticleCard>

              {/* 5 — RISK & PSYCHOLOGY */}
              <ArticleCard
                id="risk-psychology"
                tag="Module 05 · Risk &amp; Psychology"
                title="Risk Management & Trading Psychology"
                read="12 min read"
              >
                <P>
                  Strategy gets you into the game. Risk management keeps you in it.
                  Psychology decides whether you ever become consistent. This is the module
                  that separates traders from gamblers.
                </P>

                <H2>1. The First Rule: Protect Your Capital</H2>
                <P>
                  You cannot trade tomorrow if you blow up today. Capital preservation is not
                  defensive — it's the offensive weapon that lets compounding do its job.
                </P>
                <UL>
                  <LI>Risk no more than <strong>0.5% – 1%</strong> of your account per trade</LI>
                  <LI>Cap your daily loss at <strong>2% – 3%</strong>. Hit it? Stop trading.</LI>
                  <LI>Cap your weekly loss at <strong>5%</strong>. Reset your mindset before resuming.</LI>
                </UL>

                <ImageHint>
                  "Risk-Reward Ratio Diagram — 1R risk vs 2R, 3R, 5R targets"
                </ImageHint>

                <H2>2. Position Sizing — The Math That Saves You</H2>
                <P>
                  Position size = (Account × Risk %) ÷ (Stop distance × Pip value). Use a
                  calculator every single trade. Never eyeball it.
                </P>

                <H2>3. The Risk-Reward Ratio</H2>
                <UL>
                  <LI>Minimum target: <strong>1:2 R:R</strong></LI>
                  <LI>With a 40% win rate at 1:2 R:R you are still profitable</LI>
                  <LI>Skip any setup that doesn't offer at least 1:2 — there's always another bus</LI>
                </UL>

                <H2>4. The Psychology Stack</H2>
                <H3>Fear</H3>
                <P>
                  Fear cuts winners early and prevents you from pulling the trigger on valid
                  setups. The cure is a written plan and small enough size that the outcome
                  doesn't threaten you.
                </P>
                <H3>Greed</H3>
                <P>
                  Greed makes you oversize, chase, and remove stops. The cure is fixed,
                  pre-defined risk per trade — non-negotiable.
                </P>
                <H3>Revenge Trading</H3>
                <P>
                  The single most expensive habit in trading. Lose a trade → close the
                  platform for 30 minutes. Always.
                </P>
                <H3>FOMO</H3>
                <P>
                  The market opens 5 days a week, 24 hours a day. There is no last bus. If you
                  missed the entry, you missed it.
                </P>

                <ImageHint>
                  "Trader's emotional cycle — euphoria, denial, capitulation, hope, recovery"
                </ImageHint>

                <H2>5. The Trading Journal — Your Mirror</H2>
                <UL>
                  <LI>Log every trade: setup, entry, stop, target, emotion, outcome</LI>
                  <LI>Review weekly — patterns of mistakes always emerge</LI>
                  <LI>Patterns you can <em>see</em> are patterns you can <em>fix</em></LI>
                </UL>

                <H2>6. The Process Mindset</H2>
                <P>
                  Stop grading yourself by P&amp;L. Grade yourself by execution: did you follow
                  the plan? Yes? Good trade — even if it lost. Process is the only thing you
                  control. Outcome will follow.
                </P>

                <KeyTakeaway>
                  Amateurs focus on entries. Professionals focus on risk. Masters focus on
                  themselves.
                </KeyTakeaway>
              </ArticleCard>

              {/* 6 — STRATEGIES */}
              <ArticleCard
                id="trading-strategies"
                tag="Module 06 · Strategies"
                title="Trading Strategies: Frameworks That Actually Work"
                read="8 min read"
              >
                <P>
                  A strategy is a repeatable set of rules with a measurable edge. You don't
                  need many — you need one you trust and can execute on autopilot.
                </P>

                <H3>Trend Following</H3>
                <UL>
                  <LI>Higher highs, higher lows on Daily / 4H</LI>
                  <LI>Buy pullbacks to EMA 20 / 50 in the direction of trend</LI>
                  <LI>Stop below the swing low. Target the prior high. Trail aggressively.</LI>
                </UL>

                <H3>Breakout Trading</H3>
                <UL>
                  <LI>Identify a clean range or compression on the higher timeframe</LI>
                  <LI>Wait for a candle close beyond the level on increased volume</LI>
                  <LI>Enter on retest. Stop inside the range. Target = range height.</LI>
                </UL>

                <H3>Mean Reversion</H3>
                <UL>
                  <LI>Best in ranging markets and near key S/R</LI>
                  <LI>RSI extremes + reversal candle at structure</LI>
                  <LI>Quick targets — mean reversion fades fast</LI>
                </UL>

                <H3>News &amp; Macro Plays</H3>
                <UL>
                  <LI>Define scenarios <em>before</em> the release</LI>
                  <LI>Wait for the dust to settle — never trade the first 60 seconds</LI>
                  <LI>Combine the macro bias with a clean technical entry</LI>
                </UL>

                <KeyTakeaway>
                  Don't collect strategies — master one. A boring strategy executed flawlessly
                  beats a brilliant strategy executed sometimes.
                </KeyTakeaway>
              </ArticleCard>

              {/* 7 — ADVANCED */}
              <ArticleCard
                id="advanced-topics"
                tag="Module 07 · Advanced"
                title="Advanced Topics: Where Edge Compounds"
                read="20 min read"
              >
                <P>
                  Once your foundation is solid, these are the levers that take you from
                  consistent to elite — including two of the most powerful (and most
                  misunderstood) frameworks in technical analysis: <strong>Harmonic
                  Patterns</strong> and <strong>Elliott Wave Theory</strong>.
                </P>

                <H3>Order Flow &amp; Liquidity</H3>
                <UL>
                  <LI>Where are stops sitting? Above prior highs and below prior lows</LI>
                  <LI>Smart money hunts liquidity before reversing — learn to spot the sweep</LI>
                  <LI>Use volume profile and footprint charts to read intent</LI>
                </UL>

                <H3>Intermarket Analysis</H3>
                <UL>
                  <LI>DXY ↑ → most pairs lower, gold pressured</LI>
                  <LI>US10Y ↑ → growth stocks compressed, JPY weaker</LI>
                  <LI>Oil ↑ → CAD strength, inflation pressure</LI>
                </UL>

                <H3>Correlation &amp; Portfolio Risk</H3>
                <P>
                  Three "different" trades that are all short USD is one trade with triple
                  size. Always sum your <em>true</em> exposure across positions.
                </P>

                <H3>Algorithmic &amp; Systematic Edges</H3>
                <UL>
                  <LI>Backtest before you trade — Pine Script, Python, or TradingView Strategy Tester</LI>
                  <LI>Forward-test on demo for at least 30 trades</LI>
                  <LI>Track expectancy, max drawdown, and Sharpe — not just win rate</LI>
                </UL>

                <H2>Harmonic Patterns</H2>
                <P>
                  Harmonic patterns are geometric price structures that use Fibonacci ratios
                  to define precise reversal zones. Unlike most methods, harmonics attempt to
                  predict <em>where</em> price will turn — and <em>how long</em> the move
                  will last. The first pattern was discovered by H.M. Gartley in 1935;
                  modern harmonics come from the work of Bryce Gilmore and Scott Carney, who
                  ascribed precise mathematical ratios to each structure.
                </P>

                <ImageHint>"Harmonic pattern XABCD framework with Fibonacci levels overlaid"</ImageHint>

                <H3>The ABCD Pattern (Foundation)</H3>
                <P>
                  The building block of every harmonic. AB and CD are the legs; BC is the
                  retracement. In an ideal ABCD, the two legs are equal in distance and time.
                </P>
                <UL>
                  <LI>C retraces to <strong>0.618</strong> → D projects to <strong>1.618</strong> of BC</LI>
                  <LI>C retraces to <strong>0.786</strong> → D projects to <strong>1.27</strong> of BC</LI>
                  <LI>
                    <strong>Alternate ABCD</strong> — CD ≠ AB but maintains a Fibonacci
                    relationship. Used to validate higher patterns (Bat, Crab).
                  </LI>
                </UL>

                <H3>The 5-0 Pattern</H3>
                <P>
                  Trend continuation pattern that triggers <em>after</em> a major reversal.
                  BC extends 1.618–2.24 of AB, then CD retraces 50% of BC and equals AB in
                  length. The completion of CD is the entry.
                </P>

                <H3>Gartley Pattern</H3>
                <P>
                  The original. A trend continuation pattern with strict Fibonacci ratios:
                </P>
                <UL>
                  <LI>Clear ABCD structure</LI>
                  <LI>Point B at <strong>0.618</strong> of XA</LI>
                  <LI>Point D at <strong>0.786</strong> of XA</LI>
                  <LI>D = 1.272 or 1.618 projection of BC</LI>
                </UL>

                <H3>Bat Pattern (and Alternate Bat)</H3>
                <P>
                  Strong XA leg, then a two-wave correction that terminates at the{" "}
                  <strong>0.886</strong> retracement of XA. B retraces only to 0.382–0.50
                  (must be &lt; 0.618). CD typically extends to 1.27 of AB. Bats often retrace
                  hard from D — tight stops required.
                </P>
                <P>
                  The <strong>Alternate Bat</strong> uses a 0.382 B point and a 1.13
                  extension of XA at D — point D is at least 2.0 (up to 3.16) of BC.
                </P>

                <H3>Butterfly Pattern</H3>
                <P>
                  Strong XA leg, B retraces to <strong>0.786</strong>, BC bounce, then CD
                  extends <em>beyond</em> the X start point — usually to 1.27 of XA (sometimes
                  1.618). CD is normally 1.618 of AB. Failed Gartleys often morph into
                  Butterflies before reversing.
                </P>

                <H3>Crab &amp; Deep Crab</H3>
                <UL>
                  <LI>
                    <strong>Crab</strong> — B retraces 0.382–0.618. D extends to{" "}
                    <strong>1.618 of XA</strong> and 2.24–3.16 of AB. Tight reversal zone =
                    smaller stop loss.
                  </LI>
                  <LI>
                    <strong>Deep Crab</strong> — uses 0.886 at B (instead of 0.382–0.618),
                    same 1.618 XA extension at D. Volatile reversal zone, very tight stops.
                  </LI>
                </UL>

                <H3>Shark Pattern</H3>
                <P>
                  A trend-change pattern (not a retracement entry) that follows a failed
                  impulse AB wave. Similar to a 5-0 but without the D leg. Entry at point C
                  reversal zone (0.886 or 1.13 of the 0-X leg). First target = 50% retrace
                  of BC.
                </P>

                <H3>Three Drives Pattern</H3>
                <P>
                  An ABCD with an extra leg. Each leg starts at a Fibonacci retracement of
                  the previous and completes at a precise projection (1.13, 1.27, or 1.618).
                  Time and price symmetry across legs is essential.
                </P>

                <H2>Elliott Wave Theory</H2>
                <P>
                  The Elliott Wave Principle describes how mass psychology swings between
                  pessimism and optimism in <em>repeating, measurable patterns</em>. If you
                  can identify the pattern and your position within it, you can anticipate
                  the most likely next move — and just as importantly, what the market{" "}
                  <em>won't</em> do next.
                </P>

                <ImageHint>"Elliott Wave 5-3 cycle with motive and corrective sub-waves labelled"</ImageHint>

                <H3>The Core Pattern: 5 + 3</H3>
                <UL>
                  <LI>
                    <strong>Motive waves</strong> — five sub-waves moving with the larger
                    trend (1, 2, 3, 4, 5)
                  </LI>
                  <LI>
                    <strong>Corrective waves</strong> — three sub-waves moving against the
                    larger trend (A, B, C)
                  </LI>
                </UL>
                <P>
                  Within a correction, A and C are themselves smaller five-wave impulses; B
                  is a three-wave correction.
                </P>

                <H3>Impulse Wave — The Rules</H3>
                <UL>
                  <LI>Wave 1 must be an impulse or leading diagonal</LI>
                  <LI>Wave 2 may be any correction except a triangle; cannot retrace &gt; 100% of Wave 1</LI>
                  <LI>Wave 3 must be an impulse and longer than Wave 2</LI>
                  <LI>Wave 4 may be any correction; must NOT trade into Wave 1 territory</LI>
                  <LI>Wave 5 must be an impulse or ending diagonal</LI>
                  <LI><strong>Wave 3 is never the shortest</strong> when compared to 1 and 5</LI>
                </UL>
                <P>
                  Most impulses contain an <strong>extension</strong> in one (and only one)
                  of the three actionary sub-waves — most commonly Wave 3. If Waves 1 and 3
                  are roughly equal, expect Wave 5 to extend. If Wave 3 extends, Wave 5 will
                  resemble Wave 1.
                </P>

                <H3>Diagonal Triangles</H3>
                <P>
                  Five-wave motive patterns within converging trendlines (wedge shape).
                  Wave 4 always trades into Wave 1 territory.
                </P>
                <UL>
                  <LI>
                    <strong>Ending Diagonal</strong> (3-3-3-3-3) — exhaustion at the end of a
                    larger move. Appears in 5th wave, C wave of A-B-C, or final C of double/triple threes.
                  </LI>
                  <LI>
                    <strong>Leading Diagonal</strong> (5-3-5-3-5) — appears in Wave 1 of an
                    impulse or A of a zigzag.
                  </LI>
                </UL>

                <H3>Corrective Patterns</H3>
                <UL>
                  <LI>
                    <strong>Zig-zag (5-3-5)</strong> — sharp 3-wave correction labelled A-B-C.
                    A is motive, B is corrective and shorter than A, C is motive. The most
                    common corrective pattern.
                  </LI>
                  <LI>
                    <strong>Regular Flat (3-3-5)</strong> — B ends near start of A; C ends
                    slightly past end of A.
                  </LI>
                  <LI>
                    <strong>Expanded Flat (3-3-5)</strong> — B exceeds start of A; C ends
                    well beyond end of A.
                  </LI>
                  <LI>
                    <strong>Running Flat (3-3-5)</strong> — B exceeds start of A; C falls
                    short of A's ending level.
                  </LI>
                  <LI>
                    <strong>Triangle (3-3-3-3-3)</strong> — five-wave A-B-C-D-E counter-trend
                    pattern, contracting or expanding.
                  </LI>
                  <LI>
                    <strong>Combinations (Double / Triple Threes)</strong> — sideways
                    combinations of zig-zags, flats, and triangles, labelled W-X-Y(-X-Z).
                  </LI>
                </UL>

                <KeyTakeaway>
                  Advanced edge isn't a secret indicator. It's reading what others can't see —
                  liquidity, correlation, harmonic geometry, the wave structure beneath the
                  noise, and your own behaviour.
                </KeyTakeaway>
              </ArticleCard>

              {/* 8 — VIDEO LIBRARY */}
              <ArticleCard
                id="video-library"
                tag="Bonus · Free"
                title="Webinars & Video Library"
                read="Always-on"
              >
                <P>
                  Theory becomes intuition when you watch real traders execute in real markets.
                  Our live webinars and on-demand video library are <strong>free for every
                  member</strong> of the IX Live Trading Room.
                </P>

                <UL>
                  <LI>Daily live sessions — London &amp; New York opens, with Q&amp;A</LI>
                  <LI>Recorded archive — every webinar, indexed by topic and instrument</LI>
                  <LI>Trade-of-the-day breakdowns from our senior analysts</LI>
                  <LI>Member workshops on journaling, risk, and psychology</LI>
                </UL>

                <ImageHint>
                  "Grid of recent webinar thumbnails with play overlays and live badges"
                </ImageHint>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/webinars"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition"
                  >
                    <Video className="h-4 w-4" />
                    Join Live Webinars
                  </Link>
                  <Link
                    to="/videos"
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition"
                  >
                    <BookOpen className="h-4 w-4" />
                    Open Video Library
                  </Link>
                </div>
              </ArticleCard>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Education;
