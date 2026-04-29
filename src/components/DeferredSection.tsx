import { ReactNode, useEffect, useRef, useState } from "react";

interface DeferredSectionProps {
  children: ReactNode;
  className?: string;
  minHeight?: number;
  rootMargin?: string;
}

const DeferredSection = ({
  children,
  className,
  minHeight = 120,
  rootMargin = "700px 0px",
}: DeferredSectionProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={!ready ? { minHeight } : undefined}>
      {ready ? children : null}
    </div>
  );
};

export default DeferredSection;
