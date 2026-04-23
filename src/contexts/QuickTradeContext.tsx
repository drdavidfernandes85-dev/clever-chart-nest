import { createContext, useContext, useState, ReactNode } from "react";

interface QuickTradeContextValue {
  open: boolean;
  symbol: string;
  side: "buy" | "sell";
  openTrade: (symbol?: string, side?: "buy" | "sell") => void;
  close: () => void;
  setSymbol: (s: string) => void;
  setSide: (s: "buy" | "sell") => void;
}

const QuickTradeContext = createContext<QuickTradeContextValue | null>(null);

export const QuickTradeProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("EUR/USD");
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const openTrade = (s?: string, sd?: "buy" | "sell") => {
    if (s) setSymbol(s);
    if (sd) setSide(sd);
    setOpen(true);
  };

  return (
    <QuickTradeContext.Provider
      value={{ open, symbol, side, openTrade, close: () => setOpen(false), setSymbol, setSide }}
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
