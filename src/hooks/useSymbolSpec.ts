/**
 * useSymbolSpec — Fetches per-symbol trading specification from Trading Layer
 * via the get-mt5-terminal-data edge function (which already returns `specs`
 * for the requested symbol).
 *
 * Spec fields exposed by Trading Layer (all OPTIONAL — TL may return null for any):
 *   digits, point, contractSize, tickValue, tickSize,
 *   volumeMin, volumeMax, volumeStep,
 *   currencyBase, currencyProfit, currencyMargin
 *
 * NOT exposed by Trading Layer (flagged to caller via `missing`):
 *   - minimum stop distance (trade_stops_level / freeze_level)
 *   - per-symbol leverage / margin rate
 *   - filling/order mode constants (informational only)
 *
 * Callers must handle null spec fields gracefully — never fabricate values.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SymbolSpec {
  symbol: string;
  digits: number | null;
  point: number | null;
  contractSize: number | null;
  /** Generic per-tick value (legacy). Kept for backwards compat. */
  tickValue: number | null;
  /** Per-tick value for the profit side. Drives TP projection. */
  tickValueProfit: number | null;
  /** Per-tick value for the loss side. Drives SL projection. */
  tickValueLoss: number | null;
  tickSize: number | null;
  volumeMin: number | null;
  volumeMax: number | null;
  volumeStep: number | null;
  currencyBase: string | null;
  currencyProfit: string | null;
  currencyMargin: string | null;
  /** Diagnostics only — NOT a license to synthesise margin client-side. */
  tradeCalcMode: number | null;
}

/** Required-for-trading spec fields. If any are null we expose them via `missing`. */
const REQUIRED_FIELDS: (keyof SymbolSpec)[] = [
  "digits",
  "contractSize",
  "tickValue",
  "tickSize",
  "volumeMin",
  "volumeMax",
  "volumeStep",
];

interface State {
  spec: SymbolSpec | null;
  loading: boolean;
  error: string | null;
  /** List of required fields TL did not provide. Empty when complete. */
  missing: string[];
}

export function useSymbolSpec(symbol: string | null | undefined): State {
  const [state, setState] = useState<State>({
    spec: null,
    loading: false,
    error: null,
    missing: [],
  });
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setState({ spec: null, loading: false, error: null, missing: [] });
      return;
    }
    const sym = symbol.toUpperCase();
    if (inFlight.current === sym) return;
    inFlight.current = sym;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-mt5-terminal-data",
          { body: { selectedSymbol: sym } },
        );
        if (error) {
          setState({ spec: null, loading: false, error: error.message, missing: [] });
          return;
        }
        if (!data?.success) {
          setState({
            spec: null,
            loading: false,
            error: data?.error || "No se pudo cargar la especificación del símbolo.",
            missing: [],
          });
          return;
        }
        const s = data?.specs ?? null;
        if (!s) {
          setState({
            spec: null,
            loading: false,
            error: "El bróker no devolvió especificaciones para este símbolo.",
            missing: REQUIRED_FIELDS,
          });
          return;
        }
        const spec: SymbolSpec = {
          symbol: sym,
          digits: s.digits ?? null,
          point: s.point ?? null,
          contractSize: s.contractSize ?? null,
          tickValue: s.tickValue ?? null,
          tickValueProfit: s.tickValueProfit ?? null,
          tickValueLoss: s.tickValueLoss ?? null,
          tickSize: s.tickSize ?? null,
          volumeMin: s.volumeMin ?? null,
          volumeMax: s.volumeMax ?? null,
          volumeStep: s.volumeStep ?? null,
          currencyBase: s.currencyBase ?? null,
          currencyProfit: s.currencyProfit ?? null,
          currencyMargin: s.currencyMargin ?? null,
          tradeCalcMode: s.tradeCalcMode ?? null,
        };
        const missing = REQUIRED_FIELDS.filter((f) => spec[f] == null) as string[];
        setState({ spec, loading: false, error: null, missing });
      } catch (e: any) {
        setState({
          spec: null,
          loading: false,
          error: e?.message || "Network error",
          missing: [],
        });
      } finally {
        inFlight.current = null;
      }
    })();
  }, [symbol]);

  return state;
}
