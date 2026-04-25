import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LineChart,
  Radio,
  MessageSquare,
  Trophy,
  Video,
  BarChart3,
  
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Users,
  Newspaper,
  CalendarDays,
} from "lucide-react";
import { useWebinars } from "@/hooks/useWebinars";
import sidebarLogo from "@/assets/logo-sidebar.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Premium left rail navigation. Collapsible on desktop, hidden on mobile
 * (mobile uses MobileBottomNav). Inspired by top-tier trading platforms.
 */

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

const DashboardSidebar = () => {
  const { pathname } = useLocation();
  // Auto-collapse on the Chatroom route to maximize chat real estate
  const [collapsed, setCollapsed] = useState(() => pathname === "/chatroom");
  useEffect(() => {
    if (pathname === "/chatroom") setCollapsed(true);
  }, [pathname]);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { liveNow, upcoming } = useWebinars();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const infinoxLogo = sidebarLogo;
  // "starting soon" = within the next 30 minutes
  const startingSoon =
    !!upcoming &&
    new Date(upcoming.scheduled_at).getTime() - Date.now() < 30 * 60 * 1000;
  const showLiveBadge = !!liveNow || startingSoon;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex sticky top-0 h-screen flex-col border-r border-primary/15 bg-card/40 backdrop-blur-xl transition-[width] duration-300 ease-out",
        collapsed ? "w-[68px]" : "w-[224px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-primary/10 px-3">
        <Link to="/" className="flex items-center gap-2 min-w-0 leading-none">
          <img
            src={infinoxLogo}
            alt="INFINOX IX Live Trading Room"
            className="h-9 w-9 shrink-0 object-contain"
            draggable={false}
          />
          {!collapsed && (
            <>
              <span className="h-5 w-px bg-border/50 shrink-0" aria-hidden="true" />
              <span className="truncate font-heading text-[11px] font-semibold leading-tight text-foreground tracking-tight">
                <span className="text-primary">IX</span> Live Trading Room
              </span>
            </>
          )}
        </Link>
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
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                    isWebinars &&
                      "ring-1 ring-primary/20 hover:ring-primary/40"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                      isWebinars && "text-primary"
                    )}
                  />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  {!collapsed && showBadge && (
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                        liveNow
                          ? "bg-destructive text-destructive-foreground animate-pulse"
                          : "bg-primary/20 text-primary"
                      )}
                    >
                      <span className="relative flex h-1 w-1">
                        <span
                          className={cn(
                            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                            liveNow ? "bg-destructive-foreground" : "bg-primary",
                          )}
                        />
                        <span
                          className={cn(
                            "relative inline-flex h-1 w-1 rounded-full",
                            liveNow ? "bg-destructive-foreground" : "bg-primary",
                          )}
                        />
                      </span>
                      {liveNow ? t("sidebar.live") : t("sidebar.soon")}
                    </span>
                  )}
                  {/* Collapsed-state dot */}
                  {collapsed && showBadge && (
                    <span
                      className={cn(
                        "absolute top-1 right-1 h-2 w-2 rounded-full",
                        liveNow ? "bg-destructive animate-pulse" : "bg-primary",
                      )}
                    />
                  )}
                  {!collapsed && active && !showBadge && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

      </nav>

      {/* Online traders counter */}
      <div className="border-t border-primary/10 px-3 py-2.5">
        {collapsed ? (
          <div
            className="flex flex-col items-center gap-1"
            title="Traders online"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(145_65%_50%)] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(145_65%_50%)]" />
            </span>
            <span className="font-mono text-[9px] tabular-nums text-muted-foreground">12K</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-card/60 px-2.5 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(145_65%_50%)] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(145_65%_50%)]" />
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
        )}
      </div>

      {/* Sign out */}
      {user && (
        <button
          onClick={handleSignOut}
          title={collapsed ? t("sidebar.signOut") : undefined}
          className={cn(
            "flex items-center gap-2 border-t border-primary/10 px-3 py-2.5 text-[12px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("sidebar.signOut")}</span>}
        </button>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex h-10 items-center justify-center gap-2 border-t border-primary/10 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span>{t("sidebar.collapse")}</span>
          </>
        )}
      </button>
    </aside>
  );
};

export default DashboardSidebar;
