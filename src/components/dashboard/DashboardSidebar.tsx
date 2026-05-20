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
  Activity,
  Zap,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Users,
  Newspaper,
  CalendarDays,
  GraduationCap,
  Copy,
} from "lucide-react";
import { useWebinars } from "@/hooks/useWebinars";

import LtrLogoBrand from "@/components/branding/LtrLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { LOCALE_FLAGS, LOCALE_LABELS, type Locale, type TranslationKey } from "@/i18n/translations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

/**
 * Premium left rail navigation. Collapsible on desktop, hidden on mobile
 * (mobile uses MobileBottomNav). Inspired by top-tier trading platforms.
 */

const NAV: { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; flagship?: boolean; label?: string }[] = [
  { to: "/dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard },
  { to: "/trading-room", labelKey: "sidebar.tradingRoom", icon: Activity },
  { to: "/chatroom", labelKey: "sidebar.chatroom", icon: MessageSquare },
  { to: "/webinars", labelKey: "sidebar.liveWebinars", icon: Radio, flagship: true },
  { to: "/ideas", labelKey: "sidebar.signals", icon: Zap, label: "Ideas" },
  { to: "/news", labelKey: "sidebar.news", icon: Newspaper },
  { to: "/analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
  { to: "/leaderboard", labelKey: "sidebar.leaderboard", icon: Trophy },
  { to: "/videos", labelKey: "sidebar.videoLibrary", icon: Video },
  { to: "/education", labelKey: "sidebar.education", icon: GraduationCap },
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
  const { t, locale, setLocale } = useLanguage();
  const localeOrder: Locale[] = ["en", "es", "pt"];
  const { theme } = useTheme();
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
      {/* Brand — IX LTR PRO */}
      <div className="flex h-16 items-center justify-between border-b border-[#FFCD05]/15 px-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 leading-none" aria-label="IX LTR PRO — Home">
          {collapsed ? (
            <LtrLogoBrand variant="icon" className="h-8 w-8 shrink-0" />
          ) : (
            <LtrLogoBrand variant="platform" className="h-9 w-auto" />
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
                  title={collapsed ? (item.label ?? t(item.labelKey)) : undefined}
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
                  {!collapsed && <span className="truncate">{item.label ?? t(item.labelKey)}</span>}
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

      {/* Language switcher */}
      <div className={cn("border-t border-primary/10", collapsed ? "px-0 py-0" : "px-3 py-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title={collapsed ? LOCALE_LABELS[locale] : undefined}
              className={cn(
                collapsed
                  ? "flex h-10 w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                  : "flex w-full items-center gap-2 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
              )}
              aria-label="Change language"
            >
              {collapsed ? (
                <span className="font-mono">{locale.toUpperCase()}</span>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-base leading-none">{LOCALE_FLAGS[locale]}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider">{locale}</span>
                  <span className="ml-auto truncate text-[10px] text-muted-foreground">
                    {LOCALE_LABELS[locale]}
                  </span>
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            {localeOrder.map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  locale === l && "text-primary font-semibold"
                )}
              >
                <span>{LOCALE_FLAGS[l]}</span>
                <span>{LOCALE_LABELS[l]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
