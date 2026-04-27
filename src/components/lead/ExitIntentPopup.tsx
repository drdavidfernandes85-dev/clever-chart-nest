import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, PlayCircle, BookOpen, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import LeadCaptureForm from "./LeadCaptureForm";

const SESSION_KEY = "ixltr.exitIntent.shown";
const CAPTURED_KEY = "ixltr.lead.captured";

// Routes where we never show the exit popup
const EXCLUDED = ["/login", "/register", "/forgot-password", "/reset-password"];

const ExitIntentPopup = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (EXCLUDED.includes(location.pathname)) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (localStorage.getItem(CAPTURED_KEY)) return;

    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 8000); // arm only after 8s on page

    const onMouseLeave = (e: MouseEvent) => {
      if (!armed) return;
      // Triggered when cursor exits viewport from the top
      if (e.clientY <= 0) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setOpen(true);
        cleanup();
      }
    };

    // Mobile fallback: trigger on rapid scroll-up after 20s
    let mobileTimer: number | undefined;
    if (window.matchMedia("(max-width: 768px)").matches) {
      mobileTimer = window.setTimeout(() => {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        sessionStorage.setItem(SESSION_KEY, "1");
        setOpen(true);
        cleanup();
      }, 45000);
    }

    document.addEventListener("mouseleave", onMouseLeave);

    function cleanup() {
      window.clearTimeout(arm);
      if (mobileTimer) window.clearTimeout(mobileTimer);
      document.removeEventListener("mouseleave", onMouseLeave);
    }

    return cleanup;
  }, [location.pathname]);

  if (EXCLUDED.includes(location.pathname)) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md overflow-hidden border-primary/30 bg-background/95 p-0 backdrop-blur-2xl shadow-[0_0_60px_hsl(45_100%_50%/0.35)]">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent blur-3xl" />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative px-6 pt-7 pb-6">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Wait — Free Offer
            </div>

            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="font-heading text-3xl font-bold leading-tight">
                Before you go<span className="text-primary">...</span>
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Get free access to our <span className="font-semibold text-foreground">Daily Live Webinars</span> and our full <span className="font-semibold text-foreground">Educational Replay Library</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <PlayCircle className="h-3.5 w-3.5 text-primary" /> Daily live sessions
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" /> 50+ replays
              </div>
            </div>

            <LeadCaptureForm
              source="exit_intent"
              ctaLabel="Yes, Send Me Free Access"
              onSuccess={() => setTimeout(() => setOpen(false), 1800)}
            />

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 block w-full text-center text-[11px] text-muted-foreground/80 hover:text-foreground"
            >
              No thanks
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExitIntentPopup;
