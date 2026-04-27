import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { markNavigationEnd, markNavigationStart } from "@/lib/route-metrics";

/**
 * Non-blocking page transition.
 *
 * Strategy:
 *   - Keep the previously-rendered children mounted while the new route loads.
 *   - When the path changes, freeze the current tree, then swap in the new
 *     tree on the next animation frame. This avoids the "black flash" that
 *     occurs when a Suspense fallback unmounts the previous page.
 *   - A short, gentle fade is applied to the new tree only.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    markNavigationStart(location.pathname);
    // Bump the animation key only on real path changes, then mark end
    setAnimKey((k) => k + 1);
    const id = requestAnimationFrame(() => markNavigationEnd());
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  return (
    <div key={animKey} className="animate-hero-blur-in">
      {children}
    </div>
  );
};

export default PageTransition;
