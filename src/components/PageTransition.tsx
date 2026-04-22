import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Cinematic page transition: blur + fade + slight rise.
 * Replaces the previous opacity-only transition.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey((k) => k + 1);
  }, [location.pathname]);

  return (
    <div key={key} className="animate-hero-blur-in">
      {children}
    </div>
  );
};

export default PageTransition;
