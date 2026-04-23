import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LineChart,
  Radio,
  MessageSquare,
  Trophy,
  Video,
  BarChart3,
  Wrench,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Users,
} from "lucide-react";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Premium left rail navigation. Collapsible on desktop, hidden on mobile
 * (mobile uses MobileBottomNav). Inspired by top-tier trading platforms.
 */

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live-chart", label: "Live Charts", icon: LineChart },
  { to: "/signals", label: "Signals", icon: Radio },
  { to: "/chatroom", label: "Chatroom", icon: MessageSquare },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/videos", label: "Video Library", icon: Video },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: User },
];

const DashboardSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

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
      <div className="flex h-14 items-center justify-between border-b border-primary/10 px-3">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={infinoxLogo} alt="INFINOX" className="h-5 shrink-0" />
          {!collapsed && (
            <span className="truncate font-proxima text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Elite Room
            </span>
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
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <div className="mt-6 px-2.5">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                  Tools
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground mb-2">
                Risk calculator, journal & AI copilot.
              </p>
              <Link
                to="/command-deck"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                Open deck →
              </Link>
            </div>
          </div>
        )}
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
                online
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      {user && (
        <button
          onClick={handleSignOut}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center gap-2 border-t border-primary/10 px-3 py-2.5 text-[12px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
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
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
};

export default DashboardSidebar;
