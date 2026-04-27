import { useEffect, useState } from "react";
import { Sunrise, RefreshCw, Volume2, VolumeX, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY_BASE = "infinox-daily-briefing";

interface Briefing {
  briefing: string;
  generatedAt: string;
}

const SPEECH_LANG: Record<string, string> = { en: "en-US", es: "es-ES", pt: "pt-BR" };

const DailyBriefing = () => {
  const { locale, t } = useLanguage();
  const storageKey = `${STORAGE_KEY_BASE}.${locale}`;
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { toast } = useToast();

  const load = async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed: Briefing = JSON.parse(cached);
          const ageHours = (Date.now() - new Date(parsed.generatedAt).getTime()) / 36e5;
          if (ageHours < 6) {
            setData(parsed);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-daily-briefing", {
        body: { locale },
      });
      if (error) throw error;
      if (result?.briefing) {
        setData(result);
        localStorage.setItem(storageKey, JSON.stringify(result));
      }
    } catch (e: any) {
      toast({ title: t("ai.briefingError"), description: e?.message || t("ai.tryAgain"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Refetch / read cache whenever the user's locale changes
  useEffect(() => {
    setData(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const speak = () => {
    if (!data?.briefing) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const cleaned = data.briefing.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = SPEECH_LANG[locale] || "en-US";
    utter.rate = 1.05;
    utter.pitch = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Sunrise className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-semibold text-foreground">{t("ai.dailyBriefing")}</h3>
            <p className="text-[10px] text-muted-foreground">
              {data?.generatedAt
                ? `${t("ai.updated")} ${new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : t("ai.poweredBy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={speak} disabled={!data || loading} aria-label={t("ai.readAloud")}>
            {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => load(true)} disabled={loading} aria-label={t("ai.refresh")}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("ai.generating")}
        </div>
      ) : data ? (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-strong:text-primary prose-headings:text-foreground">
          <ReactMarkdown>{data.briefing}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("ai.briefingUnavailable")}</p>
      )}
    </div>
  );
};

export default DailyBriefing;
