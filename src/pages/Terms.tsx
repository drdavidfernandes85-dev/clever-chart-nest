import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";

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

const Terms = () => (
  <>
    <SEO
      title="Terms & Conditions"
      description="Terms and conditions governing use of the trading room, trade ideas, and third-party trading technology provided by Trading Layer."
      canonical="https://elitelivetradingroom.com/terms"
    />
    <Navbar />
    <main className="container max-w-3xl py-24">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-GB", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <div className="mt-3">
          <PoweredByTradingLayer />
        </div>
      </header>

      <div className="space-y-7">
        <Section title="1. Introduction">
          <p>
            These Terms govern your use of the trading room platform ("the
            Platform"), including educational content, trade ideas, follow /
            copy tools, and third-party trading technology integrations.
          </p>
        </Section>
        <Section title="2. Eligibility">
          <p>
            You must be of legal age in your jurisdiction and legally permitted
            to use leveraged trading products. Access may be restricted in
            certain jurisdictions.
          </p>
        </Section>
        <Section title="3. Educational Purpose">
          <p>
            All content — including trade ideas, analysis, webinars, chat, and
            community discussion — is provided for educational and
            informational purposes only.
          </p>
        </Section>
        <Section title="4. No Investment Advice">
          <p>
            Nothing on the Platform constitutes investment advice, financial
            advice, a personal recommendation, or a solicitation to buy or sell
            any financial instrument.
          </p>
        </Section>
        <Section title="5. Trade Ideas">
          <p>
            Trade ideas are educational examples of analysis prepared by
            mentors and community members. Following, copying, modifying, or
            executing an idea is optional and at your sole discretion.
          </p>
        </Section>
        <Section title="6. Third-Party Technology / Trading Layer">
          <p>
            Trade-execution technology, copy / follow tooling, and related
            automation are provided by Trading Layer, an independent
            third-party technology provider. The Platform integrates with
            Trading Layer to relay orders to your connected MT5 account.
          </p>
        </Section>
        <Section title="7. User-Controlled Execution">
          <p>
            Every order is submitted under your control and confirmed by you.
            The Platform does not place orders autonomously without your
            explicit action.
          </p>
        </Section>
        <Section title="8. Risk of Trading">
          <p>
            Trading leveraged products involves significant risk and may result
            in losses exceeding your initial investment. You must only trade
            with capital you can afford to lose.
          </p>
        </Section>
        <Section title="9. No Performance Guarantee">
          <p>
            Past performance is not indicative of future results. No outcome,
            return, or profit is guaranteed.
          </p>
        </Section>
        <Section title="10. Account Connection">
          <p>
            To use execution features you must connect your own MT5 account.
            The broker provides the MT5 trading account connection only,
            subject to approval and its own terms. The broker does not provide
            trade ideas, copy-trading services, or third-party trading
            technology.
          </p>
        </Section>
        <Section title="11. Platform Availability">
          <p>
            The Platform is provided on an "as is" basis. Availability may be
            interrupted for maintenance, upgrades, or factors outside our
            control.
          </p>
        </Section>
        <Section title="12. User Responsibility">
          <p>
            You are solely responsible for the trading decisions you make and
            the orders you submit to your MT5 account.
          </p>
        </Section>
        <Section title="13. Prohibited Use">
          <p>
            You may not use the Platform for unlawful activity, market
            manipulation, abusive behaviour, automated scraping, or circumvention
            of risk controls.
          </p>
        </Section>
        <Section title="14. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, the Platform, its
            operators, and Trading Layer are not liable for trading losses,
            execution outcomes, or third-party broker behaviour.
          </p>
        </Section>
        <Section title="15. Changes to Terms">
          <p>
            We may update these Terms from time to time. Continued use of the
            Platform after changes constitutes acceptance of the updated Terms.
          </p>
        </Section>
        <Section title="16. Contact / Compliance Review">
          <p>
            For compliance, regulatory, or data-protection enquiries, please
            contact us via the contact section on the homepage.
          </p>
        </Section>

        <Section title="Privacy &amp; data note">
          <p>
            MT5 credentials are encrypted at rest and used only to establish
            the account connection. Trading Layer powers the trading
            technology. The Platform may store your account number, server,
            execution logs, audit logs, and trading-room activity for
            operational, security, and compliance purposes.
          </p>
        </Section>
      </div>
    </main>
    <Footer />
  </>
);

export default Terms;
