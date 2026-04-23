import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, LineChart, Radio, Users, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/live-chart", icon: LineChart, label: "Charts" },
  { to: "/signals", icon: Radio, label: "Signals" },
  { to: "/chatroom", icon: Users, label: "Community" },
  { to: "/profile", icon: MoreHorizontal, label: "More" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();

  if (!user) return null;
  if (pathname.startsWith("/chatroom")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-card/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile navigation"
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ to, icon: Icon, label }) => {
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
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
