import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import infinoxLogo from "@/assets/infinox-logo-white.png";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  
  { label: "Education", href: "#education" },
  { label: "Team", href: "#team" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

        <div className="hidden items-center gap-0 lg:flex">
          {navLinks.map((link, i) => (
            <span key={link.label} className="flex items-center">
              <a
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </a>
              {i < navLinks.length - 1 && (
                <span className="text-border/60 text-xs">|</span>
              )}
            </span>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/chatroom">Chatroom</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/login">Login</Link>
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-full px-6 font-semibold" asChild>
            <Link to="/register">Sign Up</Link>
          </Button>
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
            <Button variant="ghost" size="sm" asChild className="justify-start text-muted-foreground">
              <Link to="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="justify-start text-muted-foreground">
              <Link to="/chatroom" onClick={() => setMobileOpen(false)}>Chatroom</Link>
            </Button>
            <div className="flex gap-2 mt-1">
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                <Link to="/login">Login</Link>
              </Button>
              <Button size="sm" asChild className="rounded-full">
                <Link to="/register">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
