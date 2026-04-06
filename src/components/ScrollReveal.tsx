import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const ScrollReveal = ({ children, className }: ScrollRevealProps) => {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  );
};

export default ScrollReveal;
