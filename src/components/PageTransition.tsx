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
  const [displayed, setDisplayed] = useState<ReactNode>(children);
  const [animKey, setAnimKey] = useState(0);
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      markNavigationStart(location.pathname);
      prevPathRef.current = location.pathname;
    }
    // Defer swap one frame so the outgoing tree gets to paint a final frame
    const id = requestAnimationFrame(() => {
      setDisplayed(children);
      setAnimKey((k) => k + 1);
      // Mark navigation end after the new tree commits
      requestAnimationFrame(() => markNavigationEnd());
    });
    return () => cancelAnimationFrame(id);
  }, [children, location.pathname]);

  return (
    <div key={animKey} className="animate-hero-blur-in">
      {displayed}
    </div>
  );
};

export default PageTransition;
