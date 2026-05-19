import { Link } from "react-router-dom";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";

/**
 * Global risk disclaimer rendered across every authenticated page in the
 * trading room. Required for broker / compliance review.
 */
const ComplianceFooter = () => (
  <footer
    role="contentinfo"
    aria-label="Risk disclosure"
    className="mt-8 border-t border-border/40 bg-background/40 px-4 py-5 text-[11px] leading-relaxed text-muted-foreground/80"
  >
    <div className="mx-auto max-w-5xl space-y-2 text-center">
      <p>
        <strong className="font-semibold text-foreground/80">
          Risk warning:
        </strong>{" "}
        Trading leveraged products involves significant risk and may not be
        suitable for all investors. You may lose more than your initial
        investment. The content in this trading room is provided for
        educational and informational purposes only and does not constitute
        investment advice, financial advice, or a recommendation to buy or
        sell any financial instrument. Users are solely responsible for their
        trading decisions.
      </p>
      <p className="text-muted-foreground/60">
        Trading Layer is an independent third-party technology provider. The
        broker is not the provider of trade ideas, copy / follow
        functionality, or third-party trading technology. The broker's role
        is limited to the provision of the trading account and execution
        venue, subject to its own terms and regulatory permissions.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
        <Link to="/terms" className="hover:text-primary transition-colors">
          Terms & Conditions
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/risk-disclosure"
          className="hover:text-primary transition-colors"
        >
          Risk Disclosure
        </Link>
        <span aria-hidden="true">·</span>
        <PoweredByTradingLayer variant="muted" />
      </div>
    </div>
  </footer>
);

export default ComplianceFooter;
