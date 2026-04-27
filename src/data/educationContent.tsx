import {
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
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import gettingStartedHero from "@/assets/edu/getting-started.jpg";
import macroHero from "@/assets/edu/macro-analysis.jpg";
import technicalHero from "@/assets/edu/technical-analysis.jpg";
import patternsHero from "@/assets/edu/chart-patterns.jpg";
import riskHero from "@/assets/edu/risk-psychology.jpg";
import strategiesHero from "@/assets/edu/trading-strategies.jpg";
import advancedHero from "@/assets/edu/advanced-topics.jpg";
import videoHero from "@/assets/edu/video-library.jpg";

export type ModuleSlug =
  | "getting-started"
  | "macro-analysis"
  | "technical-analysis"
  | "chart-patterns"
  | "risk-psychology"
  | "trading-strategies"
  | "advanced-topics"
  | "video-library";

export type EducationModule = {
  slug: ModuleSlug;
  number: string;
  title: string;
  shortTitle: string;
  summary: string;
  read: string;
  icon: LucideIcon;
  hero: string;
  badgeSlug: string; // matches public.badges.slug
  body: () => JSX.Element;
};

/* ------------ Reusable atoms (article-internal) -------------- */

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

/* -------------------- Module bodies -------------------- */

const GettingStartedBody = () => (
  <>
    <P>
      Trading is a craft. Before you risk a single dollar, you need a clear roadmap, the right
      tools, and realistic expectations. This module gives you the foundation every successful
      trader builds on.
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
      You don't need 20 indicators or three monitors to start. You need a clean chart, a
      written plan, and the discipline to follow it.
    </KeyTakeaway>
  </>
);

const MacroBody = () => (
  <>
    <P>
      Macro analysis looks at the behaviour of an economy as a whole over the medium term,
      taking into account every force that drives its performance. Each economy has its own
      characteristics and dynamics — shaped by monetary &amp; fiscal policy, politics,
      technology, and law — but every economy is measured with the same standardised toolkit
      of economic data.
    </P>
    <P>
      When you analyse a currency pair, you're really comparing the macro outlook of two
      countries. The same logic applies to equities, indices, precious metals, and commodities
      — each is anchored to an underlying economic story. The combination of{" "}
      <strong>macro analysis</strong> for trade direction and{" "}
      <strong>technical analysis</strong> for entry &amp; exit is one of the most powerful
      weapons in a trader's arsenal.
    </P>
    <ImageHint>
      "Global macro dashboard — central bank rates, inflation, GDP, and risk sentiment in one view"
    </ImageHint>
    <H2>1. Leading Indicators</H2>
    <P>
      Leading indicators move <em>before</em> the broader economy does. They give early
      warning of expansion or contraction — and that's where the edge lives.
    </P>
    <H3>Payroll Data (e.g. US Non-Farm Payrolls)</H3>
    <P>
      Collected monthly by national statistics agencies (in the US, the BLS samples 400,000+
      businesses to produce the headline NFP number). It's the most-watched gauge of labour
      market health and reacts quickly to changing conditions. <strong>200K+</strong> is
      typical of expansion; readings near zero — or negative spikes — signal contraction.
    </P>
    <H3>Production Indicators</H3>
    <UL>
      <LI><strong>Manufacturing Production</strong> — % change in inflation-adjusted output by manufacturers. Positive = expansion, negative = contraction.</LI>
      <LI><strong>Industrial Production</strong> — same idea but covers the entire industrial sector (manufacturers, mines, utilities).</LI>
      <LI><strong>Inventory Levels</strong> — rising inventories signal weak consumer demand and a softening economy.</LI>
    </UL>
    <P>
      Production figures are highly sensitive to interest rates and consumer demand, making
      them a useful forecast for future GDP growth and inflation.
    </P>
    <H3>Retail Sales</H3>
    <P>
      The most reliable gauge of consumer spending — which accounts for{" "}
      <strong>60–70% of GDP</strong> in most western economies. Few releases give you a
      cleaner read on the real-time pulse of the economy.
    </P>
    <H3>Jobless Claims (Initial &amp; Continuing)</H3>
    <UL>
      <LI><strong>Initial Claims</strong> — first-time filings for unemployment insurance (weekly).</LI>
      <LI><strong>Continuing Claims</strong> — total ongoing recipients.</LI>
    </UL>
    <P>Rising claims signal a deteriorating labour force and a weakening economy.</P>
    <H3>Building Permits / Housing Starts</H3>
    <P>
      Building permits track the rate of change of permits issued; housing starts track new
      constructions underway. Construction is typically one of the first sectors to enter
      recession when conditions deteriorate, so these two are powerful early-warning indicators.
    </P>
    <H3>Purchasing Managers' Index (PMI / ISM)</H3>
    <P>
      Purchasing managers have early access to company performance data — so their activity
      leads the broader economy. PMIs cover Manufacturing, Construction, and Services. The US
      ISM index is the benchmark, surveying hundreds of firms across employment, production,
      inventories, new orders, and deliveries.
    </P>
    <UL>
      <LI><strong>50</strong> = flat</LI>
      <LI><strong>&gt; 50</strong> = expansion</LI>
      <LI><strong>&lt; 50</strong> = contraction</LI>
    </UL>
    <H3>House Price Index</H3>
    <P>
      Tracks the rate of change of average home selling prices. Rising prices reflect strong
      housing demand and broader economic strength.
    </P>
    <ImageHint>
      "Leading indicators dashboard — NFP, PMI, Retail Sales, Jobless Claims trend lines"
    </ImageHint>
    <H2>2. Lagging Indicators</H2>
    <P>
      Lagging indicators confirm what leading indicators have already hinted at. They don't
      predict — they verify. But they move markets all the same, because central banks act on them.
    </P>
    <H3>Gross Domestic Product (GDP)</H3>
    <P>
      GDP measures total inflation-adjusted output of goods and services. The most-watched
      figure is the Quarter-on-Quarter change. Higher-than-expected GDP is bullish for a
      country's currency; lower is bearish.
    </P>
    <P>Two consecutive negative QoQ readings = a <strong>recession</strong>.</P>
    <p className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 font-mono text-[13px] italic text-foreground/85">
      GDP = Consumption + Investment + Government Spending + (Exports − Imports)
    </p>
    <H3>Unemployment Rate</H3>
    <P>The percentage of the workforce actively looking for employment. Three forms to know:</P>
    <UL>
      <LI><strong>Frictional</strong> — the natural floor caused by workers and employers transitioning.</LI>
      <LI><strong>Structural</strong> — longer-lasting, driven by technology, competition, or policy shifts.</LI>
      <LI><strong>Seasonal</strong> — driven by predictable seasonal demand swings.</LI>
    </UL>
    <P>
      Pair it with the <strong>Labour Force Participation Rate (LFPR)</strong> — a healthy
      economy has a low unemployment rate <em>and</em> elevated LFPR. A falling unemployment
      rate driven by a falling LFPR is a hollow win.
    </P>
    <H3>Inflation</H3>
    <P>The rate of change of the general level of prices for goods and services. Watch the three primary measures:</P>
    <UL>
      <LI><strong>CPI (Consumer Price Index)</strong> — the global default, measured from the consumer's perspective.</LI>
      <LI><strong>HICP (Harmonised Index of Consumer Prices)</strong> — the European standard, tracking a common basket of goods.</LI>
      <LI><strong>PCE (Personal Consumption Expenditures)</strong> — the Federal Reserve's preferred measure.</LI>
    </UL>
    <H3>Wage Growth</H3>
    <P>
      Tracked both nominal and inflation-adjusted. Wages drive disposable income — and
      according to the Phillips curve, they're the number-one cause of inflation. Critical
      for gauging future central bank moves.
    </P>
    <H3>Interest Rates</H3>
    <P>
      The central bank's primary tool — the rate at which it lends to domestic banks (Fed
      Funds Rate in the US, Base Rate in the UK, Refi Rate in the Eurozone).
    </P>
    <UL>
      <LI><strong>Cuts</strong> reduce incentive to save → encourage spending and risk-taking → stimulate the economy.</LI>
      <LI><strong>Hikes</strong> raise the cost of borrowing → reduce risk-taking → cool the economy.</LI>
    </UL>
    <P>
      Central bank rate decisions are the most-watched events on the global calendar — and
      forward guidance often matters more than the decision itself.
    </P>
    <H3>Government Balances</H3>
    <UL>
      <LI><strong>Budget Balance</strong> — revenue minus expenditures. Persistent deficits drive up government debt.</LI>
      <LI><strong>Trade Balance</strong> — exports minus imports. A surplus signals strength; a deficit creates outflows of domestic currency.</LI>
      <LI><strong>Balance of Payments (BoP)</strong> — quarterly net flow of payments in and out of the country. A persistent BoP deficit shrinks reserves and forces devaluation.</LI>
    </UL>
    <ImageHint>"Balance of Payments effect on currency supply &amp; demand curve"</ImageHint>
    <H2>3. The Risk-On / Risk-Off Lens</H2>
    <P>Macro data shifts the global mood between two regimes. Knowing which one you're in tells you which assets to favour.</P>
    <UL>
      <LI><strong>Risk-on:</strong> stocks, AUD, NZD, EM currencies, crypto rally</LI>
      <LI><strong>Risk-off:</strong> USD, JPY, CHF, gold, and bonds catch a bid</LI>
    </UL>
    <H2>4. Building Your Macro Bias — A Weekly Process</H2>
    <UL>
      <LI>Every Sunday, scan the economic calendar for the week ahead</LI>
      <LI>Identify the 1–2 highest-impact events (rate decisions, CPI, NFP, GDP)</LI>
      <LI>Map your scenarios: <em>"If CPI &gt; consensus → long USD/JPY, short Gold"</em></LI>
      <LI>Compare the macro outlook of <em>both</em> currencies in any pair</LI>
      <LI>Wait for technicals to confirm your entry — never trade macro blind</LI>
    </UL>
    <KeyTakeaway>
      Technicals tell you <strong>where</strong> to act. Macro tells you{" "}
      <strong>why</strong> the market is moving. The pros use both.
    </KeyTakeaway>
  </>
);

const TechnicalBody = () => (
  <>
    <P>
      Technical analysis began with Japanese rice traders in the 17th century and was
      formalised in the West by Charles Dow around 1900. Different origins — same core
      principles:
    </P>
    <UL>
      <LI>The <strong>"what"</strong> (price action) matters more than the <strong>"why"</strong> (news, earnings)</LI>
      <LI>All known information is already reflected in the price</LI>
      <LI>Buyers and sellers move markets through expectation, fear, and greed</LI>
    </UL>
    <H2>1. Market Regimes</H2>
    <H3>Trending Market</H3>
    <P>
      An <strong>uptrend</strong> is a succession of higher highs and higher lows. A{" "}
      <strong>downtrend</strong> is a succession of lower highs and lower lows.
    </P>
    <H3>Ranging Market</H3>
    <P>Sideways action that repeatedly tests the same highs and lows. Support and resistance levels tend to hold with high probability.</P>
    <ImageHint>"Side-by-side comparison: trending market vs ranging market"</ImageHint>
    <H2>2. Support, Resistance &amp; Confluence</H2>
    <UL>
      <LI><strong>Support</strong> — a price area where buying interest is expected to emerge.</LI>
      <LI><strong>Resistance</strong> — a price area where selling interest is expected to emerge.</LI>
      <LI><strong>Confluence Zone</strong> — when several key levels cluster. <em>Confluence is where the pros wait.</em></LI>
    </UL>
    <H2>3. Fibonacci Retracements &amp; Extensions</H2>
    <UL>
      <LI><strong>Retracement levels:</strong> 0%, 23.6%, 38.2%, 50%, 61.8%, 100%</LI>
      <LI><strong>The 61.8% level</strong> is the most-watched of all</LI>
      <LI><strong>Extensions</strong> project a move forward — used for measured moves and Elliott Wave projections.</LI>
    </UL>
    <ImageHint>"Fibonacci retracement tool drawn on EUR/USD daily"</ImageHint>
    <H2>4. Reading Candlesticks</H2>
    <P>
      A candlestick is a snapshot of the battle between buyers and sellers in a fixed time
      window. The <strong>body</strong> is the open vs close; the <strong>wicks</strong> mark
      the extremes.
    </P>
    <H3>Single-Candle Signals</H3>
    <UL>
      <LI><strong>Marubozu</strong> — no wicks. The strongest single-candle signal.</LI>
      <LI><strong>Hammer</strong> — small body at top, long lower wick. Bullish reversal at downtrend bottom.</LI>
      <LI><strong>Shooting Star</strong> — small body at bottom, long upper wick. Bearish reversal at uptrend top.</LI>
      <LI><strong>Doji</strong> — open = close. Indecision; reversal candidate at extremes.</LI>
    </UL>
    <H3>Two-Candle Patterns</H3>
    <UL>
      <LI><strong>Bullish / Bearish Engulfing</strong> — strong reversal at structure.</LI>
      <LI><strong>Bullish / Bearish Harami</strong> — small candle inside prior large body.</LI>
      <LI><strong>Piercing Line / Dark Cloud Cover</strong> — gap-and-recover reversals.</LI>
      <LI><strong>Tweezer Top / Bottom</strong> — twin candles testing the same extreme.</LI>
    </UL>
    <H3>Three-Candle Patterns</H3>
    <UL>
      <LI><strong>Morning Star</strong> — bearish → indecision → bullish closing above midpoint. Reliable bullish reversal.</LI>
      <LI><strong>Evening Star</strong> — the bearish mirror.</LI>
    </UL>
    <ImageHint>"Cheat sheet — top 12 candlestick patterns with chart context"</ImageHint>
    <H2>5. Trend &amp; Moving Averages</H2>
    <UL>
      <LI><strong>SMA</strong> — equal weight to every data point</LI>
      <LI><strong>EMA</strong> — more weight to recent data</LI>
      <LI><strong>50-day &amp; 200-day SMAs</strong> — institutional benchmarks</LI>
      <LI><strong>Golden Cross</strong> — bullish regime signal. <strong>Death Cross</strong> — bearish.</LI>
    </UL>
    <H2>6. Indicators That Actually Help</H2>
    <H3>RSI</H3>
    <p className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 font-mono text-[13px] italic text-foreground/85">
      RSI = 100 − 100 / (1 + RS), where RS = average gains / average losses
    </p>
    <UL>
      <LI><strong>Below 30</strong> — oversold</LI>
      <LI><strong>Above 70</strong> — overbought</LI>
      <LI><strong>Divergence</strong> — early warning of trend exhaustion</LI>
    </UL>
    <H3>Volume</H3>
    <UL>
      <LI>Real moves are confirmed by rising volume</LI>
      <LI>Breakouts without volume = traps</LI>
      <LI>Sharp moves on high volume + short duration near extremes = exhaustion</LI>
    </UL>
    <H2>7. Multi-Timeframe Analysis</H2>
    <P>
      Define the trend on the higher timeframe (Daily / 4H), then time the entry on the lower
      (15M / 5M). Higher-timeframe context filters out 80% of bad setups.
    </P>
    <KeyTakeaway>
      Less is more. A clean chart with structure, one moving average, one momentum tool, and a
      trained eye for candlesticks will outperform a screen full of noise — every time.
    </KeyTakeaway>
  </>
);

const PatternsBody = () => (
  <>
    <P>
      Chart patterns are the visible signature of crowd psychology. They form because traders
      react the same way to the same conditions, generation after generation.
    </P>
    <H2>1. Continuation Patterns</H2>
    <H3>Flag</H3>
    <P>A short, sloping rectangle after a strong impulsive move (the "pole"). Breakout typically resumes the prior trend with similar magnitude.</P>
    <H3>Pennant</H3>
    <P>An initial large move followed by consolidation between converging trendlines.</P>
    <H3>Bullish / Bearish Wedge</H3>
    <P>Both trendlines converge into a triangular shape.</P>
    <H3>Ascending / Descending Triangle</H3>
    <P>Pressure builds against a flat horizontal level. Ascending = bullish bias. Descending = bearish bias.</P>
    <ImageHint>"Continuation pattern cheat sheet — flag, pennant, wedge, triangle"</ImageHint>
    <H2>2. Reversal Patterns</H2>
    <H3>Double Top / Double Bottom</H3>
    <P>Two distinct peaks (or troughs) at the same price level. The second test fails to break, signalling reversal.</P>
    <H3>Triple Top / Triple Bottom</H3>
    <P>Less common but more reliable. Three failed attempts strongly suggest reversal.</P>
    <H3>Head &amp; Shoulders (Regular &amp; Inverse)</H3>
    <UL>
      <LI><strong>Entry:</strong> just below (or above) the neckline</LI>
      <LI><strong>Stop:</strong> above (or below) the right shoulder</LI>
      <LI><strong>Target:</strong> distance from head to neckline, projected from the breakout</LI>
    </UL>
    <ImageHint>"Head &amp; Shoulders on Gold (XAU/USD) with neckline break and target projection"</ImageHint>
    <H3>Cup and Handle</H3>
    <UL>
      <LI><strong>Entry:</strong> just beyond the neckline</LI>
      <LI><strong>Target:</strong> distance from extreme of the cup to the neckline</LI>
    </UL>
    <H2>3. How to Trade a Pattern Correctly</H2>
    <UL>
      <LI>Identify the pattern <em>before</em> the breakout — not after</LI>
      <LI>Wait for a clean break + close beyond the level</LI>
      <LI>Look for a retest for a low-risk entry</LI>
      <LI>Measure the pattern's height to project a realistic target</LI>
      <LI>Place the stop on the opposite side of the pattern</LI>
      <LI>Confirm with volume — real breakouts show expanding participation</LI>
    </UL>
    <ImageHint>"Anatomy of a textbook breakout: structure → break → retest → run"</ImageHint>
    <KeyTakeaway>
      Patterns don't predict — they prepare. They give you a framework for <em>where</em> to
      act and <em>where</em> you're wrong. The edge is in execution.
    </KeyTakeaway>
  </>
);

const RiskBody = () => (
  <>
    <P>
      Strategy gets you into the game. Risk management keeps you in it. Psychology decides
      whether you ever become consistent. This is the module that separates traders from
      gamblers.
    </P>
    <H2>1. The First Rule: Protect Your Capital</H2>
    <UL>
      <LI>Risk no more than <strong>0.5% – 1%</strong> of your account per trade</LI>
      <LI>Cap your daily loss at <strong>2% – 3%</strong>. Hit it? Stop trading.</LI>
      <LI>Cap your weekly loss at <strong>5%</strong>. Reset before resuming.</LI>
    </UL>
    <ImageHint>"Risk-Reward Ratio Diagram — 1R risk vs 2R, 3R, 5R targets"</ImageHint>
    <H2>2. Position Sizing</H2>
    <P>Position size = (Account × Risk %) ÷ (Stop distance × Pip value). Use a calculator every single trade.</P>
    <H2>3. The Risk-Reward Ratio</H2>
    <UL>
      <LI>Minimum target: <strong>1:2 R:R</strong></LI>
      <LI>With a 40% win rate at 1:2 R:R you are still profitable</LI>
      <LI>Skip any setup that doesn't offer at least 1:2</LI>
    </UL>
    <H2>4. The Psychology Stack</H2>
    <H3>Fear</H3>
    <P>Cuts winners early. The cure is a written plan and small enough size that the outcome doesn't threaten you.</P>
    <H3>Greed</H3>
    <P>Makes you oversize, chase, and remove stops. The cure is fixed, pre-defined risk per trade — non-negotiable.</P>
    <H3>Revenge Trading</H3>
    <P>The single most expensive habit in trading. Lose a trade → close the platform for 30 minutes. Always.</P>
    <H3>FOMO</H3>
    <P>The market opens 5 days a week, 24 hours a day. There is no last bus. If you missed the entry, you missed it.</P>
    <ImageHint>"Trader's emotional cycle — euphoria, denial, capitulation, hope, recovery"</ImageHint>
    <H2>5. The Trading Journal — Your Mirror</H2>
    <UL>
      <LI>Log every trade: setup, entry, stop, target, emotion, outcome</LI>
      <LI>Review weekly — patterns of mistakes always emerge</LI>
      <LI>Patterns you can <em>see</em> are patterns you can <em>fix</em></LI>
    </UL>
    <H2>6. The Process Mindset</H2>
    <P>
      Stop grading yourself by P&amp;L. Grade yourself by execution: did you follow the plan?
      Process is the only thing you control. Outcome will follow.
    </P>
    <KeyTakeaway>Amateurs focus on entries. Professionals focus on risk. Masters focus on themselves.</KeyTakeaway>
  </>
);

const StrategiesBody = () => (
  <>
    <P>A strategy is a repeatable set of rules with a measurable edge. You don't need many — you need one you trust and can execute on autopilot.</P>
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
    <KeyTakeaway>Don't collect strategies — master one. A boring strategy executed flawlessly beats a brilliant strategy executed sometimes.</KeyTakeaway>
  </>
);

const AdvancedBody = () => (
  <>
    <P>
      Once your foundation is solid, these are the levers that take you from consistent to
      elite — including two of the most powerful frameworks in technical analysis:{" "}
      <strong>Harmonic Patterns</strong> and <strong>Elliott Wave Theory</strong>.
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
    <P>Three "different" trades that are all short USD is one trade with triple size. Always sum your <em>true</em> exposure.</P>
    <H2>Harmonic Patterns</H2>
    <P>
      Geometric price structures that use Fibonacci ratios to define precise reversal zones.
      First discovered by H.M. Gartley in 1935; modern harmonics come from Bryce Gilmore and
      Scott Carney.
    </P>
    <ImageHint>"Harmonic pattern XABCD framework with Fibonacci levels overlaid"</ImageHint>
    <H3>The ABCD Pattern</H3>
    <UL>
      <LI>C retraces to <strong>0.618</strong> → D projects to <strong>1.618</strong> of BC</LI>
      <LI>C retraces to <strong>0.786</strong> → D projects to <strong>1.27</strong> of BC</LI>
    </UL>
    <H3>Gartley</H3>
    <UL>
      <LI>Point B at <strong>0.618</strong> of XA</LI>
      <LI>Point D at <strong>0.786</strong> of XA</LI>
      <LI>D = 1.272 or 1.618 projection of BC</LI>
    </UL>
    <H3>Bat / Alternate Bat</H3>
    <P>D terminates at <strong>0.886</strong> retracement of XA. B retraces only to 0.382–0.50. Tight stops required.</P>
    <H3>Butterfly</H3>
    <P>B retraces to <strong>0.786</strong>, then CD extends <em>beyond</em> the X start point — usually 1.27 of XA.</P>
    <H3>Crab &amp; Deep Crab</H3>
    <UL>
      <LI><strong>Crab</strong> — D extends to <strong>1.618 of XA</strong></LI>
      <LI><strong>Deep Crab</strong> — uses 0.886 at B, same 1.618 XA extension at D</LI>
    </UL>
    <H3>Shark Pattern</H3>
    <P>A trend-change pattern. Entry at point C reversal zone (0.886 or 1.13 of the 0-X leg).</P>
    <H2>Elliott Wave Theory</H2>
    <ImageHint>"Elliott Wave 5-3 cycle with motive and corrective sub-waves labelled"</ImageHint>
    <H3>The Core Pattern: 5 + 3</H3>
    <UL>
      <LI><strong>Motive waves</strong> — five sub-waves (1, 2, 3, 4, 5) with the larger trend</LI>
      <LI><strong>Corrective waves</strong> — three sub-waves (A, B, C) against the trend</LI>
    </UL>
    <H3>Impulse Wave — The Rules</H3>
    <UL>
      <LI>Wave 2 cannot retrace &gt; 100% of Wave 1</LI>
      <LI>Wave 3 must be an impulse and longer than Wave 2</LI>
      <LI>Wave 4 must NOT trade into Wave 1 territory</LI>
      <LI><strong>Wave 3 is never the shortest</strong> compared to 1 and 5</LI>
    </UL>
    <H3>Corrective Patterns</H3>
    <UL>
      <LI><strong>Zig-zag (5-3-5)</strong> — sharp 3-wave correction. The most common.</LI>
      <LI><strong>Flat (3-3-5)</strong> — Regular, Expanded, Running variants</LI>
      <LI><strong>Triangle (3-3-3-3-3)</strong> — five-wave A-B-C-D-E counter-trend</LI>
      <LI><strong>Combinations</strong> — Double / Triple Threes labelled W-X-Y(-X-Z)</LI>
    </UL>
    <KeyTakeaway>
      Advanced edge isn't a secret indicator. It's reading what others can't see — liquidity,
      correlation, harmonic geometry, the wave structure beneath the noise, and your own behaviour.
    </KeyTakeaway>
  </>
);

const VideoBody = () => (
  <>
    <P>
      Theory becomes intuition when you watch real traders execute in real markets. Our live
      webinars and on-demand video library are <strong>free for every member</strong> of the
      IX Live Trading Room.
    </P>
    <UL>
      <LI>Daily live sessions — London &amp; New York opens, with Q&amp;A</LI>
      <LI>Recorded archive — every webinar, indexed by topic and instrument</LI>
      <LI>Trade-of-the-day breakdowns from our senior analysts</LI>
      <LI>Member workshops on journaling, risk, and psychology</LI>
    </UL>
    <ImageHint>"Grid of recent webinar thumbnails with play overlays and live badges"</ImageHint>
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
        Open Video Library
      </Link>
    </div>
  </>
);

export const MODULES: EducationModule[] = [
  {
    slug: "getting-started",
    number: "01",
    title: "Getting Started: Your First Steps as a Trader",
    shortTitle: "Getting Started",
    summary: "Foundations every successful trader builds on — markets, brokers, charts, and your toolkit.",
    read: "6 min read",
    icon: Rocket,
    hero: gettingStartedHero,
    badgeSlug: "edu_getting_started",
    body: GettingStartedBody,
  },
  {
    slug: "macro-analysis",
    number: "02",
    title: "Macro Analysis: Reading the Global Economic Engine",
    shortTitle: "Macro Analysis",
    summary: "Leading & lagging indicators, central banks, and the risk-on / risk-off lens that drives every market.",
    read: "14 min read",
    icon: Globe,
    hero: macroHero,
    badgeSlug: "edu_macro_analysis",
    body: MacroBody,
  },
  {
    slug: "technical-analysis",
    number: "03",
    title: "Technical Analysis: The Language of Price",
    shortTitle: "Technical Analysis",
    summary: "Market regimes, support/resistance, Fibonacci, candlestick encyclopedia, indicators, multi-TF.",
    read: "18 min read",
    icon: CandlestickChart,
    hero: technicalHero,
    badgeSlug: "edu_technical_analysis",
    body: TechnicalBody,
  },
  {
    slug: "chart-patterns",
    number: "04",
    title: "Chart Patterns: Recurring Footprints of the Market",
    shortTitle: "Chart Patterns",
    summary: "Continuation and reversal patterns with precise entries, stops, and target projections.",
    read: "13 min read",
    icon: Activity,
    hero: patternsHero,
    badgeSlug: "edu_chart_patterns",
    body: PatternsBody,
  },
  {
    slug: "risk-psychology",
    number: "05",
    title: "Risk Management & Trading Psychology",
    shortTitle: "Risk & Psychology",
    summary: "The math, the mindset, and the discipline that separates traders from gamblers.",
    read: "12 min read",
    icon: ShieldCheck,
    hero: riskHero,
    badgeSlug: "edu_risk_psychology",
    body: RiskBody,
  },
  {
    slug: "trading-strategies",
    number: "06",
    title: "Trading Strategies: Frameworks That Actually Work",
    shortTitle: "Trading Strategies",
    summary: "Trend following, breakouts, mean reversion, and macro plays — battle-tested frameworks.",
    read: "8 min read",
    icon: Target,
    hero: strategiesHero,
    badgeSlug: "edu_trading_strategies",
    body: StrategiesBody,
  },
  {
    slug: "advanced-topics",
    number: "07",
    title: "Advanced Topics: Where Edge Compounds",
    shortTitle: "Advanced Topics",
    summary: "Order flow, intermarket analysis, harmonic patterns, and the full Elliott Wave framework.",
    read: "20 min read",
    icon: Sparkles,
    hero: advancedHero,
    badgeSlug: "edu_advanced_topics",
    body: AdvancedBody,
  },
  {
    slug: "video-library",
    number: "08",
    title: "Webinars & Video Library",
    shortTitle: "Webinars & Videos",
    summary: "Watch real traders execute in real markets — live sessions, recordings, and member workshops.",
    read: "Always-on",
    icon: Video,
    hero: videoHero,
    badgeSlug: "edu_video_library",
    body: VideoBody,
  },
];

export const TOTAL_MODULES = MODULES.length;
