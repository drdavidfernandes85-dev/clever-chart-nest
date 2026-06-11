/**
 * usePresets — read/write user_trade_presets for the order ticket.
 *
 * One row per (user_id, symbol) with `symbol = NULL` meaning the global default.
 * Symbol-specific preset wins over global on auto-fill.
 *
 * The DB types may lag behind the migration on first deploy; we cast through
 * `as any` so callers don't break while types regenerate. RLS guarantees the
 * row scope to `auth.uid() = user_id`.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PresetMode = "price" | "pips" | "amount" | "pct";
export type PresetVolumeMode = "lotes" | "usd_pt";

export interface TradePreset {
  id: string;
  user_id: string;
  /** null = global default; uppercase symbol otherwise. */
  symbol: string | null;
  sl_mode: PresetMode;
  sl_value: number | null;
  tp_mode: PresetMode;
  tp_value: number | null;
  default_volume: number | null;
  volume_mode: PresetVolumeMode;
  created_at?: string;
  updated_at?: string;
}

export type PresetDraft = Omit<TradePreset, "id" | "user_id" | "created_at" | "updated_at">;

interface State {
  presets: TradePreset[];
  loading: boolean;
  error: string | null;
}

export function usePresets() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ presets: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ presets: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await (supabase as any)
      .from("user_trade_presets")
      .select("*")
      .order("symbol", { ascending: true, nullsFirst: true });
    if (error) {
      setState({ presets: [], loading: false, error: error.message });
      return;
    }
    setState({ presets: (data as TradePreset[]) ?? [], loading: false, error: null });
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upsert = useCallback(
    async (draft: PresetDraft) => {
      if (!user) throw new Error("No autenticado");
      const payload = {
        user_id: user.id,
        symbol: draft.symbol ? draft.symbol.toUpperCase() : null,
        sl_mode: draft.sl_mode,
        sl_value: draft.sl_value,
        tp_mode: draft.tp_mode,
        tp_value: draft.tp_value,
        default_volume: draft.default_volume,
        volume_mode: draft.volume_mode,
      };
      const { error } = await (supabase as any)
        .from("user_trade_presets")
        .upsert(payload, { onConflict: "user_id,symbol_uniq_expr" })
        // onConflict needs a real unique index; fall back to manual delete+insert if missing
        .select();
      if (error) {
        // Fallback for environments where the partial index isn't supported as a conflict target
        await (supabase as any)
          .from("user_trade_presets")
          .delete()
          .match({ user_id: user.id, symbol: payload.symbol });
        const { error: insErr } = await (supabase as any)
          .from("user_trade_presets")
          .insert(payload);
        if (insErr) throw insErr;
      }
      await refresh();
    },
    [user?.id, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from("user_trade_presets").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  /** Resolve the preset to apply for a symbol: symbol-specific wins over global. */
  const resolveFor = useCallback(
    (symbol: string | null | undefined): TradePreset | null => {
      if (!symbol) return state.presets.find((p) => p.symbol == null) ?? null;
      const sym = symbol.toUpperCase();
      return (
        state.presets.find((p) => p.symbol === sym) ??
        state.presets.find((p) => p.symbol == null) ??
        null
      );
    },
    [state.presets],
  );

  return { ...state, refresh, upsert, remove, resolveFor };
}
