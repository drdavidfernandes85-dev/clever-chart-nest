import { useRef, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/**
 * Wraps any element with a subtle magnetic-cursor effect.
 * The element gently follows the mouse when hovered, snaps back on leave.
 * Pure CSS transforms — no re-renders.
 */
const MagneticButton = ({ children, className, strength = 0.35 }: MagneticButtonProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${relX * strength}px, ${relY * strength}px)`;
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("inline-block transition-transform duration-300 ease-out will-change-transform", className)}
    >
      {children}
    </div>
  );
};

export default MagneticButton;
