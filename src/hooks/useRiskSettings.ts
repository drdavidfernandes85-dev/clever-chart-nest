import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RiskSettings {
  id?: string;
  user_id?: string;
  live_trading_enabled: boolean;
  kill_switch_enabled: boolean;
  testing_mode_enabled: boolean;
  max_order_volume: number;
  max_close_volume: number;
  max_daily_volume: number;
  max_daily_trades: number;
  max_daily_loss: number;
  allowed_symbols: string[] | null;
  blocked_symbols: string[];
}

export const RISK_DEFAULTS: RiskSettings = {
  live_trading_enabled: true,
  kill_switch_enabled: false,
  testing_mode_enabled: true,
  max_order_volume: 0.01,
  max_close_volume: 0.01,
  max_daily_volume: 0.05,
  max_daily_trades: 5,
  max_daily_loss: 50,
  allowed_symbols: null,
  blocked_symbols: [],
};

const EVT = "risk-settings:changed";

/**
 * Live risk-settings hook backed by the `trading_risk_settings` table.
 * Falls back to safe defaults when no row exists.
 */
export function useRiskSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RiskSettings>(RISK_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSettings(RISK_DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("trading_risk_settings" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        ...RISK_DEFAULTS,
        ...(data as any),
        allowed_symbols:
          Array.isArray((data as any).allowed_symbols) &&
          (data as any).allowed_symbols.length > 0
            ? (data as any).allowed_symbols
            : null,
        blocked_symbols: Array.isArray((data as any).blocked_symbols)
          ? (data as any).blocked_symbols
          : [],
      });
    } else {
      setSettings(RISK_DEFAULTS);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, [refresh]);

  const save = useCallback(
    async (next: Partial<RiskSettings>, reason?: string) => {
      if (!user?.id) return;
      const merged = { ...settings, ...next };
      const payload: any = {
        user_id: user.id,
        live_trading_enabled: merged.live_trading_enabled,
        kill_switch_enabled: merged.kill_switch_enabled,
        testing_mode_enabled: merged.testing_mode_enabled,
        max_order_volume: merged.max_order_volume,
        max_close_volume: merged.max_close_volume,
        max_daily_volume: merged.max_daily_volume,
        max_daily_trades: merged.max_daily_trades,
        max_daily_loss: merged.max_daily_loss,
        allowed_symbols: merged.allowed_symbols,
        blocked_symbols: merged.blocked_symbols,
      };
      const { error } = await supabase
        .from("trading_risk_settings" as any)
        .upsert(payload, { onConflict: "user_id" });
      if (!error) {
        // best-effort change log
        for (const k of Object.keys(next) as (keyof RiskSettings)[]) {
          try {
            await supabase.from("risk_setting_audit_logs" as any).insert({
              user_id: user.id,
              changed_by: user.id,
              setting_name: String(k),
              old_value: (settings as any)[k] ?? null,
              new_value: (next as any)[k] ?? null,
              reason: reason ?? null,
            });
          } catch { /* ignore */ }
        }
        setSettings(merged);
        try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ }
      }
      return error;
    },
    [settings, user?.id],
  );

  const flags = useMemo(
    () => ({
      killSwitch: settings.kill_switch_enabled,
      testing: settings.testing_mode_enabled,
      liveEnabled: settings.live_trading_enabled && !settings.kill_switch_enabled,
    }),
    [settings],
  );

  return { settings, loading, save, refresh, flags };
}
