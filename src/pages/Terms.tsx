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
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  </section>
);

const Terms = () => {
  const { t } = useLanguage();
  return (
  <>
    <SEO
      title={t("terms.seo.title" as never)}
      description={t("terms.seo.desc" as never)}
      keywords={t("terms.seo.keywords" as never)}
      canonical="https://ixsalatrading.com/terms"
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
            These Terms &amp; Conditions ("Terms") form a binding agreement
            between you ("the User", "you") and the operators of the trading
            room platform ("the Platform", "we", "us"). They govern your access
            to and use of the Platform, including the website, dashboard,
            educational content, trade ideas, follow / review tools, community
            chat, and any third-party trading technology integrations exposed
            through the Platform.
          </p>
          <p>
            By creating an account, logging in, or otherwise using the
            Platform, you confirm that you have read, understood, and accepted
            these Terms, our Risk Disclosure, and our Privacy Notice. If you do
            not agree, you must stop using the Platform.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old (or the legal age in your
            jurisdiction, whichever is higher) and legally permitted to use
            leveraged or margin-traded financial products. You confirm that
            your use of the Platform does not breach any law or regulation
            applicable to you.
          </p>
          <p>
            Access may be restricted, limited, or denied in certain
            jurisdictions. We may refuse, suspend, or terminate access at our
            discretion where required for legal, regulatory, or risk reasons.
          </p>
        </Section>

        <Section title="3. Educational Purpose">
          <p>
            All material on the Platform — including trade ideas, charts,
            commentary, webinars, training videos, mentor messages, chat
            messages, alerts, and community discussion — is provided strictly
            for educational and informational purposes.
          </p>
          <p>
            Content is intended to help users learn about markets, trading
            concepts, and risk management. It is not tailored to your personal
            financial situation, objectives, or risk tolerance.
          </p>
        </Section>

        <Section title="4. No Investment Advice">
          <p>
            Nothing on the Platform constitutes investment advice, financial
            advice, tax advice, legal advice, a personal recommendation, or a
            solicitation to buy or sell any financial instrument.
          </p>
          <p>
            We do not act as your broker, portfolio manager, or financial
            adviser. You should seek independent professional advice before
            making any trading or investment decision.
          </p>
        </Section>

        <Section title="5. Trade Ideas">
          <p>
            Trade ideas are educational examples of analysis prepared by
            community contributors and educators. They are not signals,
            recommendations, or guaranteed outcomes.
          </p>
          <p>
            Reviewing, modifying, ignoring, or executing any idea is entirely
            optional and at your sole discretion. Any execution is initiated by
            you, under your control, and on your own MT5 account.
          </p>
        </Section>

        <Section title="6. Third-Party Technology / Trading Layer">
          <p>
            Trade-execution technology, follow / review tooling, position
            reconciliation, and related automation are provided by Trading
            Layer, an independent third-party technology provider. The Platform
            integrates with Trading Layer to relay orders that you authorise to
            your connected MT5 account.
          </p>
          <p>
            The broker does not operate, control, endorse, or supervise Trading
            Layer or the Platform's educational and idea features. The broker
            provides the MT5 trading account only.
          </p>
        </Section>

        <Section title="7. User-Controlled Execution">
          <p>
            Every order submitted via the Platform requires an explicit user
            action and confirmation. The Platform does not place, modify, or
            close orders autonomously on your behalf without your initiation.
          </p>
          <p>
            You acknowledge that once an order is confirmed, it is sent to
            Trading Layer and then to your MT5 account, where it becomes a
            live, real-money order subject to market conditions, slippage,
            spread, and broker execution.
          </p>
        </Section>

        <Section title="8. Risk of Trading">
          <p>
            Trading leveraged products such as CFDs, FX, indices, metals, and
            cryptocurrencies carries a high level of risk and may result in
            losses that exceed your deposits. You should only trade with
            capital you can afford to lose entirely.
          </p>
          <p>
            You confirm that you understand leverage, margin, liquidation, gap
            risk, overnight risk, and the risk of total loss of capital.
          </p>
        </Section>

        <Section title="9. No Performance Guarantee">
          <p>
            Past performance, hypothetical results, leaderboard statistics, and
            historical trade ideas are not indicative of future results.
          </p>
          <p>
            No outcome, return, win-rate, drawdown, or profit level is
            guaranteed by the Platform, Trading Layer, contributors, or the
            broker. Any figures shown are illustrative or historical only.
          </p>
        </Section>

        <Section title="10. Account Connection">
          <p>
            To use execution features, you must connect your own MT5 account
            from a supported broker. The broker provides the MT5 trading
            account subject to its own onboarding, KYC, and terms.
          </p>
          <p>
            The broker does not provide trade ideas, copy-trading services,
            third-party trading technology, mentor commentary, or community
            features through the Platform.
          </p>
        </Section>

        <Section title="11. Platform Availability">
          <p>
            The Platform is provided on an "as is" and "as available" basis.
            Availability may be interrupted by maintenance, upgrades, third-party
            outages (including Trading Layer, MT5, or the broker), connectivity
            issues, or factors outside our reasonable control.
          </p>
          <p>
            We do not guarantee uninterrupted access, fault-free operation, or
            that execution will always succeed. You should always be able to
            manage your positions directly via MT5.
          </p>
        </Section>

        <Section title="12. User Responsibility">
          <p>
            You are solely responsible for: the trading decisions you make, the
            orders you submit, the risk parameters you set, the protective
            stops you use, your account security, and your compliance with
            applicable laws and tax obligations.
          </p>
          <p>
            You agree to keep your login credentials confidential and to notify
            us promptly of any suspected unauthorised access.
          </p>
        </Section>

        <Section title="13. Prohibited Use">
          <p>You may not use the Platform to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>conduct unlawful activity, fraud, or market manipulation;</li>
            <li>abuse, harass, or impersonate other users or contributors;</li>
            <li>scrape, reverse-engineer, or automate access without consent;</li>
            <li>circumvent risk controls, kill-switches, or rate limits;</li>
            <li>
              redistribute, resell, or publicly broadcast trade ideas as
              signals or financial advice;
            </li>
            <li>
              upload malware or attempt to compromise Platform security.
            </li>
          </ul>
        </Section>

        <Section title="14. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, the Platform, its
            operators, employees, contributors, and Trading Layer shall not be
            liable for any trading losses, missed opportunities, execution
            outcomes, slippage, broker behaviour, data inaccuracy, downtime, or
            indirect, incidental, consequential, or punitive damages arising
            from your use of the Platform.
          </p>
          <p>
            Where liability cannot be excluded, it is limited to the fees (if
            any) paid by you to the Platform in the twelve months preceding the
            event giving rise to the claim.
          </p>
        </Section>

        <Section title="15. Changes to Terms">
          <p>
            We may update these Terms from time to time to reflect product,
            legal, or regulatory changes. Material changes will be communicated
            through the Platform or by email where appropriate.
          </p>
          <p>
            Continued use of the Platform after such changes constitutes your
            acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="16. Contact / Compliance Review">
          <p>
            For compliance, regulatory, data-protection, or risk-disclosure
            enquiries, please use the contact section on the homepage, or
            request the dedicated compliance review channel.
          </p>
          <p>
            Compliance reviewers may also consult the in-product compliance
            checklist at <code>/compliance-review</code>.
          </p>
        </Section>

        <Section title="17. Intellectual Property">
          <p>
            All Platform content, branding, software, course materials, and
            community-contributed ideas remain the property of their respective
            owners. You receive a limited, non-exclusive, non-transferable
            licence to access the Platform for personal educational use.
          </p>
          <p>
            You may not copy, redistribute, resell, or build derivative
            commercial products from Platform content without prior written
            consent.
          </p>
        </Section>

        <Section title="18. Data Protection &amp; Privacy">
          <p>
            We process personal data in line with applicable data-protection
            law. MT5 credentials are encrypted at rest and used only to
            establish the broker account connection via Trading Layer.
          </p>
          <p>
            We may store your account number, server, execution logs, audit
            events, risk-control events, and trading-room activity for
            operational, security, and compliance purposes. See the Privacy
            Notice for full details on lawful basis, retention, and your
            rights.
          </p>
        </Section>

        <Section title="19. Suspension &amp; Termination">
          <p>
            We may suspend, restrict, or terminate your access to the Platform
            (in whole or in part) if you breach these Terms, abuse risk
            controls, pose a security risk, or where required by law or
            regulator request.
          </p>
          <p>
            You may stop using the Platform at any time. Termination does not
            affect rights or obligations accrued prior to termination,
            including audit-log retention.
          </p>
        </Section>

        <Section title="20. Indemnity">
          <p>
            You agree to indemnify and hold harmless the Platform, its
            operators, Trading Layer, and the broker (in respect of services
            they each provide) from any claim, loss, liability, or expense
            arising from your breach of these Terms, your trading decisions, or
            your misuse of the Platform.
          </p>
        </Section>

        <Section title="21. Governing Law &amp; Dispute Resolution">
          <p>
            These Terms are governed by the laws of the jurisdiction stated in
            the Platform's legal notice. Disputes will be resolved through good-
            faith negotiation and, failing that, the competent courts of that
            jurisdiction, unless mandatory consumer-protection law of your
            residence applies.
          </p>
        </Section>

        <Section title="22. Severability &amp; Entire Agreement">
          <p>
            If any provision of these Terms is held unenforceable, the
            remainder will continue in full force. These Terms, together with
            the Risk Disclosure and Privacy Notice, constitute the entire
            agreement between you and us regarding the Platform.
          </p>
        </Section>

        <Section title="Privacy &amp; data note">
          <p>
            MT5 credentials are encrypted at rest and used only to establish
            the account connection. Trading Layer powers the trading
            technology. The Platform may store your account number, server,
            execution logs, audit logs, risk-control events, and trading-room
            activity for operational, security, and compliance purposes.
          </p>
        </Section>
      </div>
    </main>
    <Footer />
  </>
);

export default Terms;
