import { Search, Command as CmdIcon, Zap } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Floating Bloomberg-style command bar for fast ticker / command lookups.
 */
const CommandBar = () => (
  <div className="rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-xl px-3 py-2.5 flex items-center gap-3">
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1">
      <Zap className="h-3.5 w-3.5 text-primary" />
      <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        Clever Chart Nest
      </span>
    </div>

    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="text"
        placeholder="Type ticker or command…  (e.g. EURUSD LIVE, /signal, /journal)"
        className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border/50 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        <CmdIcon className="h-2.5 w-2.5" /> K
      </kbd>
    </div>

    <Link
      to="/register"
      className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-proxima text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
    >
      Join the Nest
    </Link>
  </div>
);

export default CommandBar;
