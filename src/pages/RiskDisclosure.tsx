import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";
import { useLanguage } from "@/i18n/LanguageContext";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
    <div className="text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  </section>
);

const RiskDisclosure = () => {
  const { t } = useLanguage();
  return (
  <>
    <SEO
      title={t("risk.seo.title" as never)}
      description={t("risk.seo.desc" as never)}
      keywords={t("risk.seo.keywords" as never)}
      canonical="https://ixsalatrading.com/risk-disclosure"
    />

    <Navbar />
    <main className="container max-w-3xl py-24">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Risk Disclosure
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You must read and understand these risks before trading.
        </p>
        <div className="mt-3">
          <PoweredByTradingLayer />
        </div>
      </header>

      <div className="space-y-7">
        <Section title="Leveraged trading risk">
          Leveraged products (CFDs, margin FX, indices) amplify both gains and
          losses. You may lose more than your initial deposit.
        </Section>
        <Section title="Market volatility">
          Prices can move rapidly and unpredictably. News, macro events, and
          low-liquidity periods can trigger sharp moves and gaps.
        </Section>
        <Section title="Liquidity risk">
          During illiquid conditions, spreads may widen, fills may slip, and it
          may be temporarily impossible to close a position at the desired
          price.
        </Section>
        <Section title="Slippage risk">
          Executed prices may differ from quoted prices, especially around news
          releases or rollover.
        </Section>
        <Section title="Execution risk">
          Order execution depends on broker, venue, and connectivity. Orders
          may be delayed, rejected, or partially filled.
        </Section>
        <Section title="Technology risk">
          Software, hardware, networks, and third-party services can fail. Such
          failures may prevent orders from being placed, modified, or closed.
        </Section>
        <Section title="Third-party integration risk">
          The Platform integrates with Trading Layer (third-party trading
          technology) and your broker. Outages or changes in those services
          can affect functionality.
        </Section>
        <Section title="Copy / follow idea risk">
          Following or copying any trade idea is your decision. No idea is
          investment advice, a recommendation, or a guarantee. You are
          responsible for every order submitted to your account.
        </Section>
        <Section title="Past performance disclaimer">
          Past performance, simulated results, and historical examples are not
          indicative of future results.
        </Section>
        <Section title="User responsibility">
          You are solely responsible for assessing whether trading is
          appropriate for you, managing your own risk, and the orders you
          submit to your MT5 account.
        </Section>
      </div>
    </main>
    <Footer />
  </>
);

export default RiskDisclosure;
