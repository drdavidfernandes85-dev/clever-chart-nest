import { useState } from "react";
import { z } from "zod";
import { Mail, User as UserIcon, ArrowRight, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { localeToPreferredLanguage } from "@/lib/preferredLanguage";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name too long"),
  email: z.string().trim().email("Enter a valid email").max(255),
});

export interface LeadCaptureFormProps {
  source: string;
  ctaLabel?: string;
  compact?: boolean;
  onSuccess?: (lead: { name: string; email: string }) => void;
}

const LEADS_KEY = "ixltr.leads";

const persistLead = (lead: { name: string; email: string; source: string; ts: string }) => {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(lead);
    localStorage.setItem(LEADS_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* noop */
  }
};

const LeadCaptureForm = ({
  source,
  ctaLabel = "Yes, Send Me Free Access",
  compact = false,
  onSuccess,
}: LeadCaptureFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      persistLead({
        name: parsed.data.name,
        email: parsed.data.email,
        source,
        ts: new Date().toISOString(),
      });
      // Mark a "seen" flag so we don't re-show exit popups
      localStorage.setItem("ixltr.lead.captured", "1");
      await new Promise((r) => setTimeout(r, 350));
      setDone(true);
      track("lead_capture", { source });
      if (/webinar/i.test(source)) track("webinar_signup", { source });
      toast.success("You're in! Check your email for the invite.");
      onSuccess?.({ name: parsed.data.name as string, email: parsed.data.email as string });
    } catch {
      toast.error("Something went wrong, please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-5 text-center">
        <CheckCircle2 className="h-8 w-8 text-primary" />
        <p className="text-sm font-semibold text-foreground">You're on the list</p>
        <p className="text-xs text-muted-foreground">
          We'll send your free webinar invites and replay library access shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="relative">
        <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          autoComplete="name"
          className="h-11 rounded-full border-white/10 bg-background/60 pl-9 backdrop-blur-md focus-visible:ring-primary/50"
        />
      </div>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          maxLength={255}
          autoComplete="email"
          className="h-11 rounded-full border-white/10 bg-background/60 pl-9 backdrop-blur-md focus-visible:ring-primary/50"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="group h-11 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066] shadow-[0_0_25px_hsl(45_100%_50%/0.45)]"
      >
        {loading ? "Sending..." : ctaLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        Educational content only. We respect your privacy — no spam.
      </p>
    </form>
  );
};

export default LeadCaptureForm;
