import { Link } from "react-router-dom";
import { Lock, ExternalLink, PlayCircle, Link2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadCaptureForm from "@/components/lead/LeadCaptureForm";

interface Props {
  reason?:
    | "no_account"
    | "not_live"
    | "low_balance"
    | "not_verified"
    | "unknown";
  balance?: number | null;
  currency?: string | null;
}

const DEPOSIT_URL = "https://myaccount.infinox.com/es/links/go/9926281";

const reasonCopy: Record<NonNullable<Props["reason"]>, string> = {
  no_account:
    "We couldn't find a connected MetaTrader account on your profile. Connect your live Infinox account to unlock the full Live Trading Room.",
  not_live:
    "Your connected MetaTrader account is a demo account. Full access requires a verified live Infinox account.",
  not_verified:
    "Your account isn't verified yet. Please complete verification on your Infinox live account to unlock full access.",
  low_balance:
    "Your live account is connected, but the net balance is below the $100 USD minimum required for full access.",
  unknown:
    "Full access requires a verified live Infinox account with a minimum net balance of $100 USD.",
};

const AccessDeniedScreen = ({ reason = "unknown", balance, currency }: Props) => {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[hsl(45,100%,50%)]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[hsl(20,90%,50%)]/10 blur-[100px]" />
      </div>

      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="relative w-full rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_120px_-40px_hsl(45,100%,50%,0.35)] backdrop-blur-xl sm:p-12">
          <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(45,100%,50%)]/30 bg-[hsl(45,100%,50%)]/10 text-[hsl(45,100%,55%)]">
            <Lock className="h-6 w-6" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Almost there! Unlock the Full Live Trading Room
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Full access requires a verified live Infinox account with a minimum
            net balance of $100 USD.
          </p>

          <div className="mx-auto mt-5 max-w-lg rounded-xl border border-white/10 bg-background/40 p-4 text-left text-sm text-muted-foreground">
            {reasonCopy[reason]}
            {reason === "low_balance" && balance != null && (
              <div className="mt-2 text-xs text-foreground/70">
                Current balance: <span className="font-semibold text-foreground">{balance.toFixed(2)} {currency ?? "USD"}</span> · Required: <span className="font-semibold text-foreground">100.00 USD</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group relative w-full overflow-hidden bg-[hsl(45,100%,50%)] font-semibold text-black hover:bg-[hsl(45,100%,55%)] sm:w-auto"
            >
              <a href={DEPOSIT_URL} target="_blank" rel="noopener noreferrer">
                Deposit Funds Now
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-white/15 bg-white/[0.02] backdrop-blur-md hover:bg-white/[0.06] sm:w-auto"
            >
              <Link to="/webinars">
                <PlayCircle className="mr-2 h-4 w-4" />
                Watch Free Webinars
              </Link>
            </Button>
          </div>

          {reason === "no_account" && (
            <div className="mt-4">
              <Link
                to="/connect-mt"
                className="inline-flex items-center gap-1.5 text-xs text-[hsl(45,100%,55%)] hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect your MetaTrader account
              </Link>
            </div>
          )}

          {/* Email capture — get notified + free webinar invites */}
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 text-left backdrop-blur-md">
            <div className="mb-2 flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Stay in the loop
              </p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Get notified when you reach the $100 balance + receive free webinar invites and educational content.
            </p>
            <LeadCaptureForm
              source="access_denied"
              ctaLabel="Notify Me + Send Free Invites"
              compact
            />
          </div>

          <p className="mx-auto mt-8 max-w-lg text-[11px] leading-relaxed text-muted-foreground/80">
            <span className="font-semibold text-foreground/70">Disclaimer:</span>{" "}
            All content is for educational purposes only. Trading involves
            significant risk of loss.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedScreen;
