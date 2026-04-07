import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string;
  className?: string;
}

const AnimatedCounter = ({ value, className }: AnimatedCounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");
  const [hasAnimated, setHasAnimated] = useState(false);

  // Extract numeric part and suffix
  const match = value.match(/^([\d.]+)(.*)$/);
  const numericValue = match ? parseFloat(match[1]) : 0;
  const suffix = match ? match[2] : value;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          observer.unobserve(el);
          
          const duration = 1500;
          const start = performance.now();
          const isDecimal = value.includes(".");

          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * numericValue;
            
            if (isDecimal) {
              const decimals = (match?.[1].split(".")[1] || "").length;
              setDisplay(current.toFixed(decimals));
            } else {
              setDisplay(Math.floor(current).toString());
            }

            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [numericValue, hasAnimated, value, match]);

  return (
    <span ref={ref} className={className}>
      {display}{suffix}
    </span>
  );
};

export default AnimatedCounter;
