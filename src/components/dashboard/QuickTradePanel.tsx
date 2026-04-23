import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Zap, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "AUD/USD", "GBP/JPY"];

const tradeSchema = z.object({
  symbol: z.string().min(3).max(10),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]),
  lots: z.number().positive().max(100),
  entry: z.number().nonnegative().optional(),
  sl: z.number().nonnegative().optional(),
  tp: z.number().nonnegative().optional(),
});

const QuickTradePanel = ({ compact = false }: { compact?: boolean }) => {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [type, setType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("1.0");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [openSymbols, setOpenSymbols] = useState(false);

  const margin = useMemo(() => {
    const l = parseFloat(lots) || 0;
    return (l * 100000) / 30; // 1:30 leverage estimate
  }, [lots]);

  const handlePlace = () => {
    const parsed = tradeSchema.safeParse({
      symbol,
      side,
      type,
      lots: parseFloat(lots),
      entry: entry ? parseFloat(entry) : undefined,
      sl: sl ? parseFloat(sl) : undefined,
      tp: tp ? parseFloat(tp) : undefined,
    });
    if (!parsed.success) {
      toast.error("Invalid order", {
        description: parsed.error.issues[0]?.message ?? "Check your inputs",
      });
      return;
    }
    if (type === "limit" && !parsed.data.entry) {
      toast.error("Limit order requires entry price");
      return;
    }
    toast.success(
      `${side.toUpperCase()} ${parsed.data.lots} lots ${symbol}`,
      {
        description: `${type.toUpperCase()}${
          parsed.data.entry ? ` @ ${parsed.data.entry}` : ""
        }${parsed.data.sl ? ` • SL ${parsed.data.sl}` : ""}${
          parsed.data.tp ? ` • TP ${parsed.data.tp}` : ""
        }`,
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${
        compact ? "" : "shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.2)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
            Quick Trade
          </h3>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Open
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Symbol selector */}
        <div className="relative">
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Symbol
          </Label>
          <button
            type="button"
            onClick={() => setOpenSymbols((v) => !v)}
            className="flex h-11 w-full items-center justify-between rounded-xl border border-border/50 bg-background/60 px-3.5 text-left transition-colors hover:border-primary/40"
          >
            <span className="font-heading text-sm font-bold text-foreground">{symbol}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSymbols ? "rotate-180" : ""}`} />
          </button>
          {openSymbols && (
            <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border/50 bg-popover shadow-xl">
              {SYMBOLS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      setSymbol(s);
                      setOpenSymbols(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-heading font-semibold transition-colors hover:bg-primary/10 hover:text-primary ${
                      s === symbol ? "text-primary bg-primary/5" : "text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Side toggle: Buy / Sell */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide("buy")}
            className={`h-11 rounded-xl font-heading text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ring-1 ${
              side === "buy"
                ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40 shadow-[0_0_20px_-5px_hsl(160_84%_50%/0.4)]"
                : "bg-muted/30 text-muted-foreground ring-border/40 hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Buy
          </button>
          <button
            onClick={() => setSide("sell")}
            className={`h-11 rounded-xl font-heading text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ring-1 ${
              side === "sell"
                ? "bg-red-500/15 text-red-400 ring-red-500/40 shadow-[0_0_20px_-5px_hsl(0_84%_60%/0.4)]"
                : "bg-muted/30 text-muted-foreground ring-border/40 hover:text-foreground"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Sell
          </button>
        </div>

        {/* Order type */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("market")}
            className={`h-9 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ring-1 ${
              type === "market"
                ? "bg-primary/15 text-primary ring-primary/40"
                : "bg-muted/20 text-muted-foreground ring-border/30 hover:text-foreground"
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setType("limit")}
            className={`h-9 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ring-1 ${
              type === "limit"
                ? "bg-primary/15 text-primary ring-primary/40"
                : "bg-muted/20 text-muted-foreground ring-border/30 hover:text-foreground"
            }`}
          >
            Limit
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Lots
            </Label>
            <Input
              inputMode="decimal"
              value={lots}
              onChange={(e) => setLots(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
              className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-primary/40"
            />
          </div>

          {type === "limit" && (
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Entry Price
              </Label>
              <Input
                inputMode="decimal"
                placeholder="0.00000"
                value={entry}
                onChange={(e) => setEntry(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))}
                className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-primary/40"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-red-400/80 mb-1.5 block">
                Stop Loss
              </Label>
              <Input
                inputMode="decimal"
                placeholder="—"
                value={sl}
                onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))}
                className="h-10 bg-background/60 border-border/50 font-mono text-xs tabular-nums focus-visible:ring-red-500/40"
              />
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80 mb-1.5 block">
                Take Profit
              </Label>
              <Input
                inputMode="decimal"
                placeholder="—"
                value={tp}
                onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))}
                className="h-10 bg-background/60 border-border/50 font-mono text-xs tabular-nums focus-visible:ring-emerald-500/40"
              />
            </div>
          </div>
        </div>

        {/* Margin estimate */}
        <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Est. Margin
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            ${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Place trade button */}
        <Button
          onClick={handlePlace}
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary font-bold text-sm tracking-wide rounded-xl shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:shadow-[0_15px_40px_-10px_hsl(48_100%_51%/0.8)] transition-all hover:scale-[1.01]"
        >
          Place {side === "buy" ? "Buy" : "Sell"} Trade
        </Button>
      </div>
    </motion.div>
  );
};

export default QuickTradePanel;
