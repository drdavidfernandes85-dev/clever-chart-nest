import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const ScrollReveal = ({ children, className, delay = 0 }: ScrollRevealProps) => {
  const { ref, isVisible } = useScrollAnimation(0.05);

  return (
    <div
      ref={ref}
      className={cn(
        "will-change-transform transition-all duration-700 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
