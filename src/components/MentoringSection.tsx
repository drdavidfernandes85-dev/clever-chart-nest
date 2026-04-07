import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, ArrowLeft, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ScrollReveal from "@/components/ScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

const MentoringSection = () => {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("booking_requests")
      .insert({ email: email.trim().toLowerCase(), purpose: "mentoring_session" });
    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
    toast.success("Request sent! We'll be in touch soon.");
  };

  return (
    <section id="education" className="relative py-28">
      <div className="absolute inset-0 bg-secondary/20" />
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute top-0 left-0 right-0 cyber-line" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>

            {!showForm && !submitted && (
              <>
                <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
                   {t("mentoring.title1")} <span className="text-gradient">{t("mentoring.title2")}</span>
                   <br />
                   <span className="text-primary-foreground">{t("mentoring.title3")}</span>
                </h2>
                <p className="mt-5 text-base text-secondary-foreground">
                  {t("mentoring.desc")}
                </p>
                <Button
                  size="lg"
                  className="mt-10 bg-primary text-primary-foreground hover:bg-primary/80 h-12 px-8 text-sm font-semibold rounded-full"
                  onClick={() => setShowForm(true)}
                >
                  {t("mentoring.book")}
                </Button>
              </>
            )}

            {showForm && !submitted && (
              <div className="animate-fade-in-up">
                <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl uppercase tracking-tight">
                  {t("mentoring.bookTitle")} <span className="text-gradient">{t("mentoring.bookTitle2")}</span>
                </h2>
                <p className="mx-auto mt-5 max-w-lg text-muted-foreground">
                  {t("mentoring.bookDesc")}
                </p>
                <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    required
                    placeholder={t("mentoring.placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full h-12 px-5"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/80 gap-2 rounded-full h-12 px-6"
                  >
                    {loading ? t("mentoring.sending") : <><Send className="h-4 w-4" /> {t("mentoring.send")}</>}
                  </Button>
                </form>
                <button
                  onClick={() => setShowForm(false)}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> {t("mentoring.back")}
                </button>
              </div>
            )}

            {submitted && (
              <div className="animate-fade-in-up">
                <CheckCircle className="mx-auto mb-4 h-14 w-14 text-primary" />
                <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl uppercase tracking-tight">
                  {t("mentoring.received")} <span className="text-gradient">{t("mentoring.received2")}</span>
                </h2>
                <p className="mt-4 text-muted-foreground">
                  {t("mentoring.receivedDesc")}
                </p>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default MentoringSection;
