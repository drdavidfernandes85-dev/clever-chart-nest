import { useRef, useEffect } from "react";
import ScrollReveal from "@/components/ScrollReveal";

const BUSINESS_UNIT_ID = "598bbe860000ff0005a886c9";

const TrustpilotSection = () => {
  const trustBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Trustpilot bootstrap script if not already loaded
    const scriptId = "trustpilot-bootstrap";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";
      script.async = true;
      script.onload = () => {
        if (trustBoxRef.current && (window as any).Trustpilot) {
          (window as any).Trustpilot.loadFromElement(trustBoxRef.current, true);
        }
      };
      document.head.appendChild(script);
    } else if (trustBoxRef.current && (window as any).Trustpilot) {
      (window as any).Trustpilot.loadFromElement(trustBoxRef.current, true);
    }
  }, []);

  return (
    <section className="relative py-24">
      <div className="absolute top-0 left-0 right-0 cyber-line" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mb-14 max-w-2xl">
            <h2 className="font-heading text-4xl font-bold text-foreground uppercase tracking-tight">
              What Our <span className="text-gradient">Clients</span>
              <br />
              <span className="text-muted-foreground/50">Say About Us</span>
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          {/* Trustpilot TrustBox Widget - Carousel */}
          <div
            ref={trustBoxRef}
            className="trustpilot-widget"
            data-locale="en-US"
            data-template-id="53aa8912dec7e10d38f59f36"
            data-businessunit-id={BUSINESS_UNIT_ID}
            data-style-height="140px"
            data-style-width="100%"
            data-theme="dark"
            data-stars="4,5"
            data-review-languages="en"
          >
            <a
              href={`https://www.trustpilot.com/review/www.infinox.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              See reviews on Trustpilot
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default TrustpilotSection;
