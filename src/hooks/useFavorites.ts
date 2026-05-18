import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FavoriteInstrument {
  symbol: string;
  display_name: string | null;
  description: string | null;
  category: string | null;
  sort_order: number;
}

/**
 * Per-user favorite instruments, persisted in `user_favorite_instruments`.
 * Prices are NEVER stored — only the symbol identity + display metadata.
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteInstrument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("user_favorite_instruments")
      .select("symbol, display_name, description, category, sort_order")
      .order("sort_order", { ascending: true })
      .order("symbol", { ascending: true });
    if (!error && data) {
      setFavorites(data as FavoriteInstrument[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const isFavorite = useCallback(
    (sym: string) =>
      favorites.some((f) => f.symbol.toUpperCase() === sym.toUpperCase()),
    [favorites],
  );

  const add = useCallback(
    async (meta: Omit<FavoriteInstrument, "sort_order"> & { sort_order?: number }) => {
      if (!user) return;
      const sort_order = meta.sort_order ?? favorites.length;
      // Optimistic
      setFavorites((f) =>
        f.some((x) => x.symbol.toUpperCase() === meta.symbol.toUpperCase())
          ? f
          : [...f, { ...meta, sort_order } as FavoriteInstrument],
      );
      const { error } = await supabase.from("user_favorite_instruments").insert({
        user_id: user.id,
        symbol: meta.symbol,
        display_name: meta.display_name,
        description: meta.description,
        category: meta.category,
        sort_order,
      });
      if (error) await load();
    },
    [user, favorites.length, load],
  );

  const remove = useCallback(
    async (sym: string) => {
      if (!user) return;
      const prev = favorites;
      setFavorites((f) => f.filter((x) => x.symbol.toUpperCase() !== sym.toUpperCase()));
      const { error } = await supabase
        .from("user_favorite_instruments")
        .delete()
        .eq("user_id", user.id)
        .eq("symbol", sym);
      if (error) setFavorites(prev);
    },
    [user, favorites],
  );

  const toggle = useCallback(
    async (meta: Omit<FavoriteInstrument, "sort_order">) => {
      if (isFavorite(meta.symbol)) await remove(meta.symbol);
      else await add(meta);
    },
    [isFavorite, add, remove],
  );

  return { favorites, loading, isFavorite, add, remove, toggle, reload: load };
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
