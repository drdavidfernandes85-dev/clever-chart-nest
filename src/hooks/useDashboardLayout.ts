import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_PRESET,
  PresetId,
  WIDGET_IDS,
  buildResponsiveLayouts,
  getPreset,
} from "@/components/dashboard/customize/presets";
import type { LayoutItem } from "react-grid-layout";

const ALLOWED = new Set<string>(WIDGET_IDS);
const sanitize = (items: LayoutItem[] | undefined): LayoutItem[] =>
  (items ?? []).filter((l) => ALLOWED.has(l.i));

/**
 * Ensure every required widget exists in the layout. If one is missing
 * (e.g. user has an older saved layout), inject it using the default
 * preset's position so it renders instead of disappearing.
 */
const ensureAllWidgets = (items: LayoutItem[], defaults: LayoutItem[]): LayoutItem[] => {
  const present = new Set(items.map((l) => l.i));
  const missing = defaults.filter((d) => !present.has(d.i));
  return missing.length ? [...items, ...missing] : items;
};

const sanitizeLayouts = (l: Layouts): Layouts => {
  const defaults = getPreset(DEFAULT_PRESET).lg;
  return {
    lg: ensureAllWidgets(sanitize(l.lg), defaults),
    md: ensureAllWidgets(sanitize(l.md), defaults),
    sm: ensureAllWidgets(sanitize(l.sm), defaults),
    xs: ensureAllWidgets(sanitize(l.xs), defaults),
  };
};

export type Layouts = {
  lg: LayoutItem[];
  md: LayoutItem[];
  sm: LayoutItem[];
  xs: LayoutItem[];
};

const LS_KEY = "eltr.dashboard.layout.v2";

interface StoredLayout {
  preset: PresetId;
  layouts: Layouts;
}

/**
 * Persist the user's dashboard widget arrangement.
 * Loads from Lovable Cloud (user_dashboard_layouts) when authenticated,
 * with localStorage fallback for offline / cold starts.
 */
export function useDashboardLayout() {
  const { user } = useAuth();
  const [preset, setPresetState] = useState<PresetId>(DEFAULT_PRESET);
  const [layouts, setLayouts] = useState<Layouts>(() =>
    buildResponsiveLayouts(getPreset(DEFAULT_PRESET).lg),
  );
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load on mount + when auth changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      // 1) localStorage first (instant)
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredLayout;
          if (parsed?.layouts && parsed?.preset) {
            setPresetState(parsed.preset);
            setLayouts(sanitizeLayouts(parsed.layouts));
          }
        }
      } catch {
        // ignore
      }

      // 2) Cloud (authoritative if present)
      if (user) {
        const { data } = await supabase
          .from("user_dashboard_layouts")
          .select("preset, layouts")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cancelled && data && data.layouts && typeof data.layouts === "object") {
          const remote = data.layouts as unknown as Layouts;
          if (remote.lg && Array.isArray(remote.lg)) {
            setPresetState((data.preset as PresetId) ?? DEFAULT_PRESET);
            setLayouts(sanitizeLayouts(remote));
          }
        }
      }

      if (!cancelled) {
        setDirty(false);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onLayoutChange = useCallback(
    (
      _current: readonly LayoutItem[],
      all: {
        lg?: readonly LayoutItem[];
        md?: readonly LayoutItem[];
        sm?: readonly LayoutItem[];
        xs?: readonly LayoutItem[];
      },
    ) => {
      const next: Layouts = {
        lg: (all.lg as LayoutItem[]) ?? layouts.lg,
        md: (all.md as LayoutItem[]) ?? layouts.md,
        sm: (all.sm as LayoutItem[]) ?? layouts.sm,
        xs: (all.xs as LayoutItem[]) ?? layouts.xs,
      };
      setLayouts(next);
      setDirty(true);
      // Always mirror to localStorage for instant restore
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ preset, layouts: next }));
      } catch {
        // ignore
      }
    },
    [layouts, preset],
  );

  const applyPreset = useCallback((id: PresetId) => {
    const next = buildResponsiveLayouts(getPreset(id).lg);
    setPresetState(id);
    setLayouts(next);
    setDirty(true);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ preset: id, layouts: next }));
    } catch {
      // ignore
    }
  }, []);

  const resetDefault = useCallback(() => {
    applyPreset(DEFAULT_PRESET);
  }, [applyPreset]);

  const save = useCallback(async () => {
    if (!user) return { ok: false, reason: "not-authenticated" as const };
    setSaving(true);
    const payload = {
      user_id: user.id,
      preset,
      layouts: layouts as unknown as Record<string, unknown>,
    };
    const { error } = await supabase
      .from("user_dashboard_layouts")
      // upsert expects an array; cast keeps the generated types happy
      .upsert([payload] as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) return { ok: false, reason: error.message };
    setDirty(false);
    return { ok: true as const };
  }, [user, preset, layouts]);

  return {
    preset,
    layouts,
    dirty,
    loading,
    saving,
    onLayoutChange,
    applyPreset,
    resetDefault,
    save,
  };
}
