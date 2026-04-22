import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, LineChart, MessageSquare, Trophy, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/live-chart", icon: LineChart, label: "Chart" },
  { to: "/chatroom", icon: MessageSquare, label: "Chat" },
  { to: "/leaderboard", icon: Trophy, label: "Ranks" },
  { to: "/profile", icon: User, label: "Me" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();

  if (!user) return null;
  // Hide on chatroom (full-screen layout) to avoid covering input
  if (pathname.startsWith("/chatroom")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/95 backdrop-blur-xl md:hidden"
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
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
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
