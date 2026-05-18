import { useEffect, useState } from "react";

const KEY = "ixterminal.favorites.v1";
const DEFAULTS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "US30", "NAS100", "BTCUSD"];

const read = (): string[] => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.every((s) => typeof s === "string") ? arr : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  const toggle = (sym: string) => {
    const u = sym.toUpperCase();
    setFavorites((f) =>
      f.map((s) => s.toUpperCase()).includes(u)
        ? f.filter((s) => s.toUpperCase() !== u)
        : [...f, sym],
    );
  };

  const isFavorite = (sym: string) =>
    favorites.map((s) => s.toUpperCase()).includes(sym.toUpperCase());

  return { favorites, isFavorite, toggle };
}

/** Infer a friendly asset class from a symbol when broker metadata is missing. */
export function inferCategory(symbol: string, fallback?: string | null): string {
  const u = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (fallback) {
    const f = fallback.toLowerCase();
    if (f.includes("forex") || f === "fx") return "Forex";
    if (f.includes("metal") || f.includes("commod") || f.includes("energy")) return "Commodities";
    if (f.includes("ind") || f.includes("equity index")) return "Indices";
    if (f.includes("crypto")) return "Crypto";
    if (f.includes("stock") || f.includes("share") || f.includes("equity")) return "Stocks";
  }
  if (/^(XAU|XAG|XPT|XPD|WTI|UKOIL|USOIL|BRENT|NGAS)/.test(u)) return "Commodities";
  if (/^(BTC|ETH|XRP|LTC|SOL|ADA|DOGE|BNB|MATIC|DOT)/.test(u)) return "Crypto";
  if (/^(US30|US100|US500|NAS|SPX|DJ|GER|UK|FRA|JPN|HK|AUS|CHN)/.test(u) || /(100|30|40|50|225|500)$/.test(u)) return "Indices";
  if (/^[A-Z]{6}$/.test(u)) return "Forex";
  return "Stocks";
}
