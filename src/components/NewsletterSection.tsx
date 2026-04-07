import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase() });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.info("You're already subscribed!");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      return;
    }

    toast.success("Successfully subscribed!");
    setEmail("");
  };

  return (
    <section className="relative py-28">
      <div className="container relative">
        <div className="card-glass mx-auto max-w-2xl rounded-3xl p-10 text-center md:p-14">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl uppercase tracking-tight">
            {t("newsletter.title1")} <span className="text-gradient">{t("newsletter.title2")}</span>
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("newsletter.desc")}
          </p>
          <form onSubmit={handleSubscribe} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              required
              placeholder={t("newsletter.placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full h-12 px-5"
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-full h-12 px-8 font-semibold"
            >
              {loading ? t("newsletter.subscribing") : t("newsletter.subscribe")}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
