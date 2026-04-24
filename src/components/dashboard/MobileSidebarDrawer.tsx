import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  LineChart,
  Radio,
  MessageSquare,
  Trophy,
  Video,
  BarChart3,
  User,
  LogOut,
  Newspaper,
  CalendarDays,
  X,
  Users,
} from "lucide-react";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useWebinars } from "@/hooks/useWebinars";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

const NAV: { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; flagship?: boolean }[] = [
  { to: "/dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard },
  { to: "/webinars", labelKey: "sidebar.liveWebinars", icon: Radio, flagship: true },
  { to: "/signals", labelKey: "sidebar.signals", icon: Radio },
  { to: "/live-chart", labelKey: "sidebar.liveCharts", icon: LineChart },
  { to: "/chatroom", labelKey: "sidebar.chatroom", icon: MessageSquare },
  { to: "/news", labelKey: "sidebar.news", icon: Newspaper },
  { to: "/calendar", labelKey: "sidebar.calendar", icon: CalendarDays },
  { to: "/analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
  { to: "/leaderboard", labelKey: "sidebar.leaderboard", icon: Trophy },
  { to: "/videos", labelKey: "sidebar.videoLibrary", icon: Video },
  { to: "/profile", labelKey: "sidebar.profile", icon: User },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const MobileSidebarDrawer = ({ open, onClose }: Props) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { liveNow, upcoming } = useWebinars();
  const { t } = useLanguage();
  const startingSoon =
    !!upcoming &&
    new Date(upcoming.scheduled_at).getTime() - Date.now() < 30 * 60 * 1000;
  const showLiveBadge = !!liveNow || startingSoon;

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate("/");
  };

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] flex flex-col border-r border-primary/15 bg-card shadow-2xl"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {/* Brand */}
            <div className="flex h-14 items-center justify-between border-b border-primary/10 px-4">
              <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2 min-w-0">
                <img src={infinoxLogo} alt="INFINOX" className="h-5 shrink-0" />
                <span className="truncate font-proxima text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Elite Room
                </span>
              </Link>
              <button
                onClick={onClose}
                aria-label={t("dash.closeMenu")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <ul className="space-y-0.5">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.to ||
                    (item.to !== "/dashboard" && pathname.startsWith(item.to));
                  const isWebinars = item.to === "/webinars";
                  const showBadge = isWebinars && showLiveBadge;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                          isWebinars && "ring-1 ring-primary/20"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                            isWebinars && "text-primary"
                          )}
                        />
                        <span className="truncate">{t(item.labelKey)}</span>
                        {showBadge ? (
                          <span
                            className={cn(
                              "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                              liveNow
                                ? "bg-destructive text-destructive-foreground animate-pulse"
                                : "bg-primary/20 text-primary"
                            )}
                          >
                            {liveNow ? t("sidebar.live") : t("sidebar.soon")}
                          </span>
                        ) : (
                          active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                          )
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Online */}
            <div className="border-t border-primary/10 px-3 py-2.5">
              <div className="flex items-center gap-2 rounded-lg bg-card/60 px-2.5 py-1.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <Users className="h-3 w-3 text-muted-foreground" />
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                    12,487
                  </span>
                  <span className="font-proxima text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                    {t("sidebar.online")}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign out */}
            {user && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 border-t border-primary/10 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{t("sidebar.signOut")}</span>
              </button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileSidebarDrawer;
