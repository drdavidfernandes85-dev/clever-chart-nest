import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const emptyForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const ContactSection = () => {
  const [formData, setFormData] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error("Please fill in all fields");
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Message sent successfully");
      setFormData(emptyForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="py-28">
      <div className="container max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
            {t("contact.title1")} <span className="text-gradient">{t("contact.title2")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t("contact.desc")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder={t("contact.name")}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-card border-border/50 h-12"
            />
            <Input
              type="email"
              placeholder={t("contact.email")}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-card border-border/50 h-12"
            />
          </div>
          <Input
            placeholder={t("contact.subject")}
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="bg-card border-border/50 h-12"
          />
          <Textarea
            placeholder={t("contact.message")}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="bg-card border-border/50 min-h-[140px]"
          />
          <Button
            type="submit"
            disabled={sending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80 h-12 rounded-full font-semibold gap-2"
          >
            <Send className="h-4 w-4" /> {sending ? t("contact.sending") : t("contact.send")}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default ContactSection;
