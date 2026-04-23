import { createContext, useContext, useState, ReactNode } from "react";

export interface QuickTradePrefill {
  symbol?: string;
  side?: "buy" | "sell";
  lots?: string;
  entry?: string;
  sl?: string;
  tp?: string;
  signalId?: string | null;
}

interface QuickTradeContextValue {
  open: boolean;
  symbol: string;
  side: "buy" | "sell";
  prefill: QuickTradePrefill | null;
  /** Bumps every time openTrade() is called so listeners can re-apply prefill values. */
  prefillNonce: number;
  openTrade: (opts?: QuickTradePrefill) => void;
  close: () => void;
  setSymbol: (s: string) => void;
  setSide: (s: "buy" | "sell") => void;
}

const QuickTradeContext = createContext<QuickTradeContextValue | null>(null);

export const QuickTradeProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("EUR/USD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [prefill, setPrefill] = useState<QuickTradePrefill | null>(null);
  const [prefillNonce, setPrefillNonce] = useState(0);

  const openTrade = (opts?: QuickTradePrefill) => {
    if (opts?.symbol) setSymbol(opts.symbol);
    if (opts?.side) setSide(opts.side);
    setPrefill(opts ?? null);
    setPrefillNonce((n) => n + 1);
    setOpen(true);
  };

  return (
    <QuickTradeContext.Provider
      value={{
        open,
        symbol,
        side,
        prefill,
        prefillNonce,
        openTrade,
        close: () => setOpen(false),
        setSymbol,
        setSide,
      }}
    >
      {children}
    </QuickTradeContext.Provider>
  );
};

export const useQuickTrade = () => {
  const ctx = useContext(QuickTradeContext);
  if (!ctx) throw new Error("useQuickTrade must be used within QuickTradeProvider");
  return ctx;
};
