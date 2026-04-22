import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookOpen, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

interface Trade {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  status: string;
  setup_tag: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

const TradeJournal = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Form
  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [pnl, setPnl] = useState("");
  const [setup, setSetup] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTrades = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("trade_journal")
      .select("*")
      .eq("user_id", user.id)
      .order("opened_at", { ascending: false })
      .limit(20);
    setTrades(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reset = () => {
    setPair("EUR/USD");
    setDirection("long");
    setEntry("");
    setExit("");
    setPnl("");
    setSetup("");
    setNotes("");
  };

  const submit = async () => {
    if (!user) return;
    if (!pair || !entry) {
      toast.error("Pair and entry price are required");
      return;
    }
    setSubmitting(true);
    const exitNum = exit ? parseFloat(exit) : null;
    const pnlNum = pnl ? parseFloat(pnl) : null;
    const status = exitNum !== null ? "closed" : "open";
    const { error } = await supabase.from("trade_journal").insert({
      user_id: user.id,
      pair,
      direction,
      entry_price: parseFloat(entry),
      exit_price: exitNum,
      pnl: pnlNum,
      status,
      setup_tag: setup || null,
      notes: notes || null,
      closed_at: status === "closed" ? new Date().toISOString() : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Trade logged");
    reset();
    setOpen(false);
    fetchTrades();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("trade_journal").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTrades((t) => t.filter((x) => x.id !== id));
    toast.success("Trade deleted");
  };

  return (
    <Card className="card-glass p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground">Trade Journal</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Track every trade. Find your edge.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full gap-2">
              <Plus className="h-4 w-4" /> Log Trade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Log a new trade</DialogTitle>
              <DialogDescription>Leave exit + P&L empty to record an open position.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Pair</Label>
                <Input value={pair} onChange={(e) => setPair(e.target.value.toUpperCase())} placeholder="EUR/USD" />
              </div>
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as "long" | "short")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Setup tag</Label>
                <Input value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="Breakout, OB, etc." />
              </div>
              <div className="space-y-1.5">
                <Label>Entry price</Label>
                <Input type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="1.0842" />
              </div>
              <div className="space-y-1.5">
                <Label>Exit price</Label>
                <Input type="number" step="any" value={exit} onChange={(e) => setExit(e.target.value)} placeholder="1.0915" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>P&L</Label>
                <Input type="number" step="any" value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="125.50" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What worked, what didn't..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Save trade"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded skeleton-shimmer" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No trades yet. Hit <span className="text-primary font-semibold">Log Trade</span> to start your journal.
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
            {trades.map((t) => {
              const isWin = (t.pnl ?? 0) > 0;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.direction === "long" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {t.direction === "long" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">{t.pair}</span>
                      <Badge variant="secondary" className="text-[9px] uppercase rounded-full px-2 py-0">
                        {t.status}
                      </Badge>
                      {t.setup_tag && (
                        <span className="text-[10px] text-muted-foreground">· {t.setup_tag}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {t.entry_price} {t.exit_price ? `→ ${t.exit_price}` : ""}
                    </div>
                  </div>
                  {t.pnl !== null && (
                    <div className={`font-display text-base font-semibold tabular-nums ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                      {isWin ? "+" : ""}{t.pnl.toFixed(2)}
                    </div>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TradeJournal;
