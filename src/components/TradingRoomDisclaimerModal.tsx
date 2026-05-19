import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "trading-room-disclaimer-ack-v1";

/**
 * First-visit compliance gate for the trading room. Shows a blocking
 * modal that the user must explicitly acknowledge before proceeding.
 * Acknowledgement is stored in localStorage per user.
 */
const TradingRoomDisclaimerModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const key = `${STORAGE_KEY}:${user.id}`;
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [user]);

  if (!user || !open) return null;

  const accept = () => {
    try {
      localStorage.setItem(
        `${STORAGE_KEY}:${user.id}`,
        new Date().toISOString(),
      );
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trading-room-risk-notice-title"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-background/80 p-4 backdrop-blur-md sm:items-center"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border/50 bg-primary/10 px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h2
            id="trading-room-risk-notice-title"
            className="font-heading text-base font-bold uppercase tracking-wider text-foreground"
          >
            Trading Room Risk Notice
          </h2>
        </div>

        <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            This trading room provides educational tools, trade ideas, market
            information, and third-party technology integrations. Nothing in
            this platform constitutes investment advice, financial advice, or a
            personal recommendation.
          </p>
          <p>
            Trading leveraged products involves significant risk and may result
            in losses. You are solely responsible for your trading decisions and
            for any orders submitted to your MT5 account.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-foreground">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              aria-label="Acknowledge risk notice"
            />
            <span className="text-xs leading-snug">
              I have read and understood the risk notice.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/50 bg-background/30 px-5 py-3">
          <Button
            onClick={accept}
            disabled={!accepted}
            className="gap-2 rounded-full font-semibold"
          >
            <ShieldCheck className="h-4 w-4" />
            Enter Trading Room
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TradingRoomDisclaimerModal;
