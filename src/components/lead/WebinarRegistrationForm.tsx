import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, User as UserIcon, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

export interface WebinarRegistrationContext {
  webinarId?: string | null;
  topic: string;
  scheduledAt: string; // ISO string
  durationMinutes: number;
  hostName?: string | null;
  joinUrl?: string | null;
}

const LEADS_KEY = "ixltr.leads";
const REGISTERED_EMAILS_KEY = "ixltr.webinar.emails";

interface PersistedLead {
  name: string;
  email: string;
  source: string;
  ts: string;
}

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const persistLead = (lead: PersistedLead) => {
  try {
    const list = safeParse<PersistedLead[]>(localStorage.getItem(LEADS_KEY), []);
    list.push(lead);
    localStorage.setItem(LEADS_KEY, JSON.stringify(list.slice(-50)));
    const emails = safeParse<string[]>(localStorage.getItem(REGISTERED_EMAILS_KEY), []);
    if (!emails.includes(lead.email.toLowerCase())) {
      emails.push(lead.email.toLowerCase());
      localStorage.setItem(REGISTERED_EMAILS_KEY, JSON.stringify(emails.slice(-100)));
    }
    localStorage.setItem("ixltr.lead.captured", "1");
  } catch {
    /* noop */
  }
};

const isAlreadyRegistered = (email: string): boolean => {
  try {
    const emails = safeParse<string[]>(localStorage.getItem(REGISTERED_EMAILS_KEY), []);
    return emails.includes(email.toLowerCase());
  } catch {
    return false;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface WebinarRegistrationFormProps {
  source: string;
  webinar?: WebinarRegistrationContext;
}

const WebinarRegistrationForm = ({ source, webinar }: WebinarRegistrationFormProps) => {
  const { t, locale } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submittedRef = useRef(false);
  const focusedFieldsRef = useRef<Set<string>>(new Set());
  const impressionFiredRef = useRef(false);
  const containerRef = useRef<HTMLFormElement>(null);

  // Impression tracking — fires when the form scrolls into view, once per mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || impressionFiredRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      impressionFiredRef.current = true;
      track("webinar_form_impression", { source, locale });
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !impressionFiredRef.current) {
            impressionFiredRef.current = true;
            track("webinar_form_impression", { source, locale });
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [source, locale]);

  const handleFocus = (field: "name" | "email") => {
    if (focusedFieldsRef.current.has(field)) return;
    focusedFieldsRef.current.add(field);
    track("webinar_form_field_focus", { source, locale, field });
  };

  const validate = (): { name?: string; email?: string } => {
    const next: { name?: string; email?: string } = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) next.name = t("webinarLp.form.error.nameRequired");
    else if (trimmedName.length < 2) next.name = t("webinarLp.form.error.nameTooShort");
    else if (trimmedName.length > 80) next.name = t("webinarLp.form.error.nameTooLong");
    if (!trimmedEmail) next.email = t("webinarLp.form.error.emailRequired");
    else if (!EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > 255)
      next.email = t("webinarLp.form.error.emailInvalid");
    return next;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittedRef.current || loading) return;

    track("webinar_form_submit_attempt", { source, locale });

    const v = validate();
    if (v.name || v.email) {
      setErrors(v);
      track("webinar_form_submit_error", {
        source,
        locale,
        reason: "validation",
        fields: Object.keys(v),
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (isAlreadyRegistered(cleanEmail)) {
      setErrors({ email: t("webinarLp.form.error.duplicate") });
      track("webinar_form_duplicate_blocked", { source, locale });
      track("webinar_form_submit_error", { source, locale, reason: "duplicate" });
      return;
    }

    setErrors({});
    setLoading(true);
    submittedRef.current = true;

    try {
      persistLead({
        name: cleanName,
        email: cleanEmail,
        source,
        ts: new Date().toISOString(),
      });
      await new Promise((r) => setTimeout(r, 350));
      setDone(true);
      track("lead_capture", { source, locale });
      track("webinar_signup", { source, locale });
      track("webinar_form_submit_success", { source, locale });
    } catch {
      submittedRef.current = false;
      setErrors({ email: t("webinarLp.form.error.generic") });
      track("webinar_form_submit_error", { source, locale, reason: "exception" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-5 text-center"
      >
        <CheckCircle2 className="h-8 w-8 text-primary" />
        <p className="text-sm font-semibold text-foreground">{t("webinarLp.form.success")}</p>
      </div>
    );
  }

  return (
    <form ref={containerRef} onSubmit={submit} noValidate className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="webinar-name" className="text-xs font-medium text-foreground/70">
          {t("webinarLp.form.nameLabel")}
        </Label>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="webinar-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
            }}
            onFocus={() => handleFocus("name")}
            placeholder={t("webinarLp.form.namePlaceholder")}
            maxLength={80}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "webinar-name-error" : undefined}
            className={`h-11 rounded-full border-white/10 bg-background/60 pl-9 backdrop-blur-md focus-visible:ring-primary/50 ${
              errors.name ? "border-destructive/70 focus-visible:ring-destructive/40" : ""
            }`}
          />
        </div>
        {errors.name && (
          <p
            id="webinar-name-error"
            role="alert"
            className="flex items-center gap-1 pl-1 text-xs font-medium text-destructive"
          >
            <AlertCircle className="h-3 w-3" />
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="webinar-email" className="text-xs font-medium text-foreground/70">
          {t("webinarLp.form.emailLabel")}
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="webinar-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            onFocus={() => handleFocus("email")}
            placeholder={t("webinarLp.form.emailPlaceholder")}
            maxLength={255}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "webinar-email-error" : undefined}
            className={`h-11 rounded-full border-white/10 bg-background/60 pl-9 backdrop-blur-md focus-visible:ring-primary/50 ${
              errors.email ? "border-destructive/70 focus-visible:ring-destructive/40" : ""
            }`}
          />
        </div>
        {errors.email && (
          <p
            id="webinar-email-error"
            role="alert"
            className="flex items-center gap-1 pl-1 text-xs font-medium text-destructive"
          >
            <AlertCircle className="h-3 w-3" />
            {errors.email}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading || submittedRef.current}
        aria-busy={loading}
        className="group h-11 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066] shadow-[0_0_25px_hsl(45_100%_50%/0.45)]"
      >
        {loading ? t("webinarLp.form.submitting") : t("webinarLp.form.cta")}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        {t("webinarLp.form.privacy")}
      </p>
    </form>
  );
};

export default WebinarRegistrationForm;
