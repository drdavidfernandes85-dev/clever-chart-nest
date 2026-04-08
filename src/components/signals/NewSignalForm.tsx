import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "NZD/USD", "USD/CAD", "XAU/USD", "GBP/JPY", "EUR/GBP"];

const NewSignalForm = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    pair: "EUR/USD",
    direction: "buy" as "buy" | "sell",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const entry = parseFloat(form.entry_price);
    if (isNaN(entry) || entry <= 0) {
      toast.error("Enter a valid entry price");
      return;
    }

    const sl = form.stop_loss ? parseFloat(form.stop_loss) : null;
    const tp = form.take_profit ? parseFloat(form.take_profit) : null;

    if (sl !== null && isNaN(sl)) { toast.error("Invalid stop loss"); return; }
    if (tp !== null && isNaN(tp)) { toast.error("Invalid take profit"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("trading_signals").insert({
      pair: form.pair,
      direction: form.direction,
      entry_price: entry,
      stop_loss: sl,
      take_profit: tp,
      notes: form.notes.trim() || null,
      author_id: user.id,
    });

    if (error) {
      toast.error("Failed to post signal. Make sure you have admin/moderator permissions.");
      console.error(error);
    } else {
      toast.success("Signal posted!");
      setForm({ pair: "EUR/USD", direction: "buy", entry_price: "", stop_loss: "", take_profit: "", notes: "" });
      setOpen(false);
    }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2 rounded-full">
        <Plus className="h-4 w-4" /> New Signal
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading text-lg font-bold text-foreground uppercase tracking-wide">Post New Signal</h3>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pair & Direction */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase mb-1.5 block">Pair</Label>
            <select
              value={form.pair}
              onChange={(e) => setForm({ ...form, pair: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase mb-1.5 block">Direction</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: "buy" })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  form.direction === "buy"
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" /> BUY
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: "sell" })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  form.direction === "sell"
                    ? "border-red-500/50 bg-red-500/20 text-red-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5" /> SELL
              </button>
            </div>
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase mb-1.5 block">Entry Price *</Label>
            <Input
              type="number"
              step="any"
              placeholder="1.08500"
              value={form.entry_price}
              onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
              required
              className="font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase mb-1.5 block">Stop Loss</Label>
            <Input
              type="number"
              step="any"
              placeholder="1.08200"
              value={form.stop_loss}
              onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}
              className="font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase mb-1.5 block">Take Profit</Label>
            <Input
              type="number"
              step="any"
              placeholder="1.09000"
              value={form.take_profit}
              onChange={(e) => setForm({ ...form, take_profit: e.target.value })}
              className="font-mono"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase mb-1.5 block">Notes (optional)</Label>
          <Textarea
            placeholder="Trade rationale, key levels, etc."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={500}
            rows={2}
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full rounded-full font-semibold">
          {submitting ? "Posting…" : "Post Signal"}
        </Button>
      </form>
    </div>
  );
};

export default NewSignalForm;
