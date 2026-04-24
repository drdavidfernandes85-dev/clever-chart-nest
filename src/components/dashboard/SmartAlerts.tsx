import { useState } from "react";
import { Bell, Sparkles, TrendingUp, Zap, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ALERTS = [
  {
    id: "a1",
    icon: Sparkles,
    title: "High-conviction signal",
    body: "EUR/USD long · 4 mentors aligned",
    tag: "92%",
  },
  {
    id: "a2",
    icon: TrendingUp,
    title: "Breakout watch",
    body: "GBP/JPY clearing 192.50 resistance",
    tag: "LIVE",
  },
  {
    id: "a3",
    icon: Zap,
    title: "Volatility spike",
    body: "XAU/USD ATR +38% in last 15m",
    tag: "ATR",
  },
];

interface Props {
  /** Render with a collapsible header (used in Live Chart workspace). */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const AlertList = () => (
  <ul className="divide-y divide-border/30">
    {ALERTS.map((a) => {
      const Icon = a.icon;
      return (
        <li
          key={a.id}
          className="flex items-start gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">{a.title}</p>
            <p className="truncate text-[10.5px] text-muted-foreground">{a.body}</p>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-primary">{a.tag}</span>
        </li>
      );
    })}
  </ul>
);

const SmartAlerts = ({ collapsible = false, defaultOpen = true }: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Smart Alerts
            </h3>
          </div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
            {ALERTS.length} new
          </span>
        </div>
        <AlertList />
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-md overflow-hidden">
        <CollapsibleTrigger className="group flex w-full items-center justify-between border-b border-border/40 px-3 py-2 hover:bg-primary/5 transition-colors data-[state=closed]:border-b-0">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Smart Alerts
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              {ALERTS.length} new
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AlertList />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default SmartAlerts;
