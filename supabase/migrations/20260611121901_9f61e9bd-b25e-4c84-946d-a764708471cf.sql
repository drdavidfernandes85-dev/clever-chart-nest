
-- =====================================================================
-- Part B: user_trade_presets
-- =====================================================================
CREATE TABLE public.user_trade_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NULL,
  sl_mode text NOT NULL DEFAULT 'pips' CHECK (sl_mode IN ('price','pips','amount','pct')),
  sl_value numeric NULL,
  tp_mode text NOT NULL DEFAULT 'pips' CHECK (tp_mode IN ('price','pips','amount','pct')),
  tp_value numeric NULL,
  default_volume numeric NULL,
  volume_mode text NOT NULL DEFAULT 'lotes' CHECK (volume_mode IN ('lotes','usd_pt')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique (user, symbol-or-global). COALESCE keeps a single global row per user
-- and one row per (user, symbol).
CREATE UNIQUE INDEX user_trade_presets_user_symbol_uniq
  ON public.user_trade_presets (user_id, COALESCE(symbol, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_trade_presets TO authenticated;
GRANT ALL ON public.user_trade_presets TO service_role;

ALTER TABLE public.user_trade_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own presets"
  ON public.user_trade_presets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert own presets"
  ON public.user_trade_presets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own presets"
  ON public.user_trade_presets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own presets"
  ON public.user_trade_presets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_trade_presets_updated_at
  BEFORE UPDATE ON public.user_trade_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- Part C: SECURITY DEFINER hardening
--   1. Tighten search_path on all 11 SECURITY DEFINER functions to
--      `public, pg_temp` so an attacker can't shadow objects via the
--      temp schema or another schema in front of public.
--   2. Re-REVOKE EXECUTE from PUBLIC (idempotent — already revoked but
--      belt-and-suspenders against any future template drift).
-- All other ACLs (authenticated / service_role) are untouched.
-- =====================================================================

-- has_role: read-only, used by RLS. Pinned + PUBLIC revoke. Authenticated grant kept.
ALTER FUNCTION public.has_role(uuid, app_role)
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;

-- award_xp: privileged write; only called via SECURITY DEFINER caller / service role.
ALTER FUNCTION public.award_xp(uuid, integer, text, jsonb)
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer, text, jsonb) FROM PUBLIC;

-- Education modules — both check auth.uid() internally.
ALTER FUNCTION public.complete_education_module(text)
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.complete_education_module(text) FROM PUBLIC;

ALTER FUNCTION public.uncomplete_education_module(text)
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.uncomplete_education_module(text) FROM PUBLIC;

-- Canary activation / disable — both check has_role(_, 'admin') internally.
ALTER FUNCTION public.activate_limited_canary_audited(jsonb, jsonb, jsonb, text, text)
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.activate_limited_canary_audited(jsonb, jsonb, jsonb, text, text) FROM PUBLIC;

ALTER FUNCTION public.disable_limited_canary_audited(text, jsonb)
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.disable_limited_canary_audited(text, jsonb) FROM PUBLIC;

-- Trigger functions (no client EXECUTE needed — triggers run as owner).
ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

ALTER FUNCTION public.handle_mentor_application_approval()
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_mentor_application_approval() FROM PUBLIC;

ALTER FUNCTION public.notify_chat_event()
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_chat_event() FROM PUBLIC;

ALTER FUNCTION public.notify_new_signal()
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_new_signal() FROM PUBLIC;

ALTER FUNCTION public.notify_webinar_live()
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_webinar_live() FROM PUBLIC;
