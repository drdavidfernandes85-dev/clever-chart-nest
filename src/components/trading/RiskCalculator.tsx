import { useEffect, useMemo, useState } from "react";
import { Calculator, X, Minimize2, Maximize2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "infinox.riskcalc.v1";

const PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF",
  "NZD/USD", "USD/CAD", "EUR/GBP", "GBP/JPY", "XAU/USD",
];

interface State {
  account: number;
  riskPct: number;
  pair: string;
  entry: number;
  stop: number;
  open: boolean;
  minimized: boolean;
}

const defaultState: State = {
  account: 10000,
  riskPct: 1,
  pair: "EUR/USD",
  entry: 1.085,
  stop: 1.082,
  open: false,
  minimized: false,
};

const loadState = (): State => {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
};

const RiskCalculator = () => {
  const [state, setState] = useState<State>(defaultState);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setState(loadState()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }));

  const refresh = () => {
    setRefreshing(true);
    setRefreshNonce((n) => n + 1);
    window.setTimeout(() => setRefreshing(false), 450);
  };

  const calc = useMemo(() => {
    const { account, riskPct, pair, entry, stop } = state;
    if (!account || !entry || !stop || entry === stop) {
      return { riskAmount: 0, pipDistance: 0, lotSize: 0, units: 0, pipValue: 0 };
    }

    const isJpy = pair.includes("JPY");
    const isGold = pair.includes("XAU");
    const pipMul = isJpy ? 100 : isGold ? 10 : 10000;
    const pipDistance = Math.abs(entry - stop) * pipMul;
    const riskAmount = account * (riskPct / 100);

    // Standard pip value per 1 standard lot in account currency (USD-quote approx)
    // EUR/USD etc: $10/pip. JPY pairs: ~$10/pip (approx using current quote). Gold: $10/pip ($0.10/oz × 100oz).
    const pipValuePerLot = 10;
    const lotSize = pipDistance > 0 ? riskAmount / (pipDistance * pipValuePerLot) : 0;
    const units = lotSize * 100000;

    return {
      riskAmount,
      pipDistance,
      lotSize,
      units,
      pipValue: pipValuePerLot * lotSize,
    };
    // refreshNonce is intentionally a dep so the manual refresh re-runs the memo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, refreshNonce]);

  if (!state.open) {
    return (
      <button
        onClick={() => update("open", true)}
        className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 hover:scale-110 transition-transform"
        aria-label="Risk calculator"
      >
        <Calculator className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[320px] rounded-2xl border border-border/50 bg-card shadow-2xl backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Risk Calculator</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => update("minimized", !state.minimized)} className="text-muted-foreground hover:text-foreground">
            {state.minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => update("open", false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!state.minimized && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Account ($)</Label>
              <Input
                type="number"
                value={state.account}
                onChange={(e) => update("account", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk %</Label>
              <Input
                type="number"
                step="0.1"
                value={state.riskPct}
                onChange={(e) => update("riskPct", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pair</Label>
            <select
              value={state.pair}
              onChange={(e) => update("pair", e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</Label>
              <Input
                type="number"
                step="any"
                value={state.entry}
                onChange={(e) => update("entry", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Stop Loss</Label>
              <Input
                type="number"
                step="any"
                value={state.stop}
                onChange={(e) => update("stop", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk amount</span>
              <span className="font-mono text-sm font-semibold text-foreground">${calc.riskAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">SL distance</span>
              <span className="font-mono text-sm font-semibold text-foreground">{calc.pipDistance.toFixed(1)} pips</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
              <span className="text-[10px] uppercase tracking-wider text-primary">Position size</span>
              <span className="font-mono text-sm font-bold text-primary">{calc.lotSize.toFixed(2)} lots</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Units</span>
              <span className="font-mono text-xs text-muted-foreground">{calc.units.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pip value</span>
              <span className="font-mono text-xs text-muted-foreground">${calc.pipValue.toFixed(2)} / pip</span>
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground/70 leading-tight">
            Estimates assume USD account and standard pip values. Always verify with your broker before placing trades.
          </p>
        </div>
      )}
    </div>
  );
};

export default RiskCalculator;
