import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, LineChart, Users, GraduationCap, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

const items: { to: string; icon: typeof LayoutDashboard; labelKey: TranslationKey }[] = [
  { to: "/dashboard", icon: LayoutDashboard, labelKey: "sidebar.dashboard" },
  { to: "/live-chart", icon: LineChart, labelKey: "sidebar.charts" },
  { to: "/chatroom", icon: Users, labelKey: "sidebar.community" },
  { to: "/education", icon: GraduationCap, labelKey: "sidebar.education" },
  { to: "/webinars", icon: Video, labelKey: "sidebar.webinars" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user) return null;
  if (pathname.startsWith("/chatroom")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-card/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile navigation"
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ to, icon: Icon, labelKey }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-primary shadow-[0_0_10px_hsl(48_100%_51%)]" />
                )}
                <Icon
                  className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`}
                />
                <span>{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
