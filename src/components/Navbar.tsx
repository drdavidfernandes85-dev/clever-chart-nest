import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import infinoxLogoWhite from "@/assets/infinox-logo-white.png";
import infinoxLogoBlack from "@/assets/infinox-logo-black.svg";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { label: t("nav.home"), href: "#home" },
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.education"), href: "#education" },
    { label: t("nav.team"), href: "#team" },
    { label: t("nav.faq"), href: "#faq" },
    { label: t("nav.contact"), href: "#contact" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "";
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-border/40 bg-background/90 backdrop-blur-2xl"
          : "bg-transparent"
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        <a href="#home" className="flex items-center gap-3">
          <img src={infinoxLogo} alt="INFINOX" className="h-6" />
          <span className="hidden sm:inline text-[10px] text-muted-foreground/30 font-light">|</span>
          <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
            Elite <span className="text-primary">Live Trading Room</span>
          </span>
        </a>

        <div className="hidden lg:flex" />

        <div className="hidden items-center gap-3 lg:flex text-foreground">
          <Button variant="ghost" size="sm" asChild className="text-foreground hover:text-primary">
            <Link to="/dashboard">{t("nav.dashboard")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-foreground hover:text-primary">
            <Link to="/signals">{t("nav.signals")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-foreground hover:text-primary">
            <Link to="/videos">{t("nav.videos")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-foreground hover:text-primary">
            <Link to="/chatroom">{t("nav.chatroom")}</Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/30 transition-colors">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {initial}
                  </span>
                  <span className="max-w-[100px] truncate">{displayName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2">
                  <User className="h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-foreground hover:text-primary">
                <Link to="/login">{t("nav.login")}</Link>
              </Button>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-full px-6 font-semibold" asChild>
                <Link to="/register">{t("nav.signup")}</Link>
              </Button>
            </>
          )}
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <button
          className="text-foreground lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/30 bg-background/95 backdrop-blur-2xl px-4 pb-4 lg:hidden">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <Button variant="ghost" size="sm" asChild className="justify-start text-muted-foreground">
              <Link to="/dashboard" onClick={() => setMobileOpen(false)}>{t("nav.dashboard")}</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="justify-start text-muted-foreground">
              <Link to="/signals" onClick={() => setMobileOpen(false)}>{t("nav.signals")}</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="justify-start text-muted-foreground">
              <Link to="/videos" onClick={() => setMobileOpen(false)}>{t("nav.videos")}</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="justify-start text-muted-foreground">
              <Link to="/chatroom" onClick={() => setMobileOpen(false)}>{t("nav.chatroom")}</Link>
            </Button>

            {user ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initial}
                </span>
                <span className="text-sm text-foreground font-medium truncate">{displayName}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="ml-auto text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                  <Link to="/login">{t("nav.login")}</Link>
                </Button>
                <Button size="sm" asChild className="rounded-full">
                  <Link to="/register">{t("nav.signup")}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
