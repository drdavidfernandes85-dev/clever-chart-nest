import { useEffect, useState } from "react";

const NAMES_POOL = ["df23fx", "IX_Mentor", "desk-trader", "pip_hunter", "EUR_King", "scalper.lab", "alpha-rat"];

/**
 * Lightweight presence-style typing indicator that occasionally rotates a
 * random subset of names to give the chat an "alive" feel.
 */
const TypingIndicator = () => {
  const [typers, setTypers] = useState<string[]>([]);

  useEffect(() => {
    const tick = () => {
      const count = Math.random() < 0.35 ? 0 : Math.floor(Math.random() * 3) + 1;
      const shuffled = [...NAMES_POOL].sort(() => Math.random() - 0.5);
      setTypers(shuffled.slice(0, count));
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, []);

  if (typers.length === 0) return <div className="h-5" />;

  const text =
    typers.length === 1
      ? `${typers[0]} is typing`
      : typers.length === 2
        ? `${typers[0]} and ${typers[1]} are typing`
        : `${typers.length} traders are typing`;

  return (
    <div className="flex h-5 items-center gap-2 text-[11px] text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
      </span>
      <span className="italic">{text}…</span>
    </div>
  );
};

export default TypingIndicator;
