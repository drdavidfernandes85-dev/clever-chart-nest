import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

const OnlineNowPill = ({ className }: Props) => {
  const [count, setCount] = useState(187);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((n) =>
        Math.max(120, Math.min(420, n + Math.floor((Math.random() - 0.5) * 6))),
      );
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 backdrop-blur-md",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <Users className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold tabular-nums text-foreground">
        {count.toLocaleString()}
      </span>
      <span className="text-[11px] text-muted-foreground">traders online now</span>
    </div>
  );
};

export default OnlineNowPill;
