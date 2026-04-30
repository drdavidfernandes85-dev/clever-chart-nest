import { Link } from "react-router-dom";
import { GraduationCap, LayoutDashboard, MessagesSquare, LineChart, PlayCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Keyword-focused internal-link block for topical relevance & crawlability.
 * Renders a localized list of cross-page anchors using the project's
 * primary SEO terms. Hide the link to the page it's currently on via
 * the `current` prop.
 */
type Page = "education" | "dashboard" | "chatroom" | "livechart" | "webinars";

interface Props {
  current: Page;
  className?: string;
}

const KeywordCrossLinks = ({ current, className }: Props) => {
  const { t } = useLanguage();

  const items: { page: Page; to: string; icon: typeof GraduationCap; label: string }[] = [
    { page: "education", to: "/education", icon: GraduationCap, label: t("seo.crosslinks.education" as any) },
    { page: "dashboard", to: "/dashboard", icon: LayoutDashboard, label: t("seo.crosslinks.dashboard" as any) },
    { page: "chatroom",  to: "/chatroom",  icon: MessagesSquare, label: t("seo.crosslinks.chatroom"  as any) },
    { page: "livechart", to: "/live-chart", icon: LineChart,     label: t("seo.crosslinks.livechart" as any) },
    { page: "webinars",  to: "/webinars",  icon: PlayCircle,    label: t("seo.crosslinks.webinars"  as any) },
  ];

  return (
    <section
      aria-labelledby="keyword-crosslinks-title"
      className={
        className ??
        "mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
      }
    >
      <div className="rounded-3xl border border-primary/20 bg-card/40 p-6 backdrop-blur-2xl shadow-[0_30px_120px_-50px_hsl(48_100%_51%/0.45)] md:p-8">
        <h2
          id="keyword-crosslinks-title"
          className="font-heading text-xl md:text-2xl font-bold text-foreground"
        >
          {t("seo.crosslinks.title" as any)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("seo.crosslinks.subtitle" as any)}
        </p>
        <nav aria-label={t("seo.crosslinks.title" as any)} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items
            .filter((i) => i.page !== current)
            .map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 rounded-xl border border-primary/20 bg-background/40 px-4 py-3 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-snug">{label}</span>
              </Link>
            ))}
        </nav>
      </div>
    </section>
  );
};

export default KeywordCrossLinks;
