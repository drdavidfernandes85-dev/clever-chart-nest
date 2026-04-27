import { ReactNode, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebarDrawer from "./MobileSidebarDrawer";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  children: ReactNode;
}

/**
 * Shared shell for every authenticated page. Renders the desktop sidebar on
 * the left and provides a mobile drawer + floating hamburger trigger so
 * users can always navigate back to other tabs from any page.
 *
 * Pages keep their own internal headers/content; this layout only owns the
 * left rail. The desktop sidebar is `sticky` + full height, so it stays in
 * place as the page scrolls.
 */
const DashboardLayout = ({ children }: Props) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { t } = useLanguage();

  // Lock body scroll when the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen flex bg-transparent">
      <DashboardSidebar />
      <MobileSidebarDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Floating mobile hamburger — visible on every page < lg */}
      <button
        onClick={() => setMobileNavOpen(true)}
        aria-label={t("dash.openMenu")}
        className="lg:hidden fixed top-3 left-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-background/80 backdrop-blur-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>{children}</div>
    </div>
  );
};

export default DashboardLayout;
