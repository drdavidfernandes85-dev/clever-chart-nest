
-- =====================================================================
-- 1. profiles: account state machine columns
-- =====================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_of_residence text,
  ADD COLUMN IF NOT EXISTS account_state text NOT NULL DEFAULT 'balance_unknown',
  ADD COLUMN IF NOT EXISTS grace_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_known_balance_usd numeric,
  ADD COLUMN IF NOT EXISTS last_balance_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_balance_source text,
  ADD COLUMN IF NOT EXISTS manual_review_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_review_reason text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_state_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_state_check
  CHECK (account_state IN ('active','grace','locked','balance_unknown'));

-- country_of_residence is ISO-3166-1 alpha-2 (e.g. 'BR','MX','AR'); NULL = unknown.
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country_of_residence);
CREATE INDEX IF NOT EXISTS idx_profiles_account_state ON public.profiles(account_state);

-- =====================================================================
-- 2. feature_flags_by_country
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.feature_flags_by_country (
  country_code text NOT NULL,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code, feature)
);
GRANT SELECT ON public.feature_flags_by_country TO authenticated;
GRANT ALL ON public.feature_flags_by_country TO service_role;
ALTER TABLE public.feature_flags_by_country ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags readable by authenticated" ON public.feature_flags_by_country;
CREATE POLICY "feature_flags readable by authenticated"
  ON public.feature_flags_by_country FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "feature_flags admin manage" ON public.feature_flags_by_country;
CREATE POLICY "feature_flags admin manage"
  ON public.feature_flags_by_country FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.feature_flags_by_country (country_code, feature, enabled, note) VALUES
  ('BR','follow_notify', false, 'Disabled in Brazil pending local compliance review.')
ON CONFLICT (country_code, feature) DO NOTHING;

-- =====================================================================
-- 3. notification_outbox (durable cross-channel queue)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('inapp','email','whatsapp','telegram')),
  event_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  dedup_key text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_outbox_dedup ON public.notification_outbox(dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_outbox_pending ON public.notification_outbox(status, channel) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_notif_outbox_user ON public.notification_outbox(user_id);

GRANT SELECT ON public.notification_outbox TO authenticated;
GRANT ALL ON public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outbox own rows read" ON public.notification_outbox;
CREATE POLICY "outbox own rows read"
  ON public.notification_outbox FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

-- =====================================================================
-- 4. entitlements_audit
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.entitlements_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prev_state text,
  new_state text NOT NULL,
  prev_balance numeric,
  new_balance numeric,
  balance_known boolean NOT NULL,
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ent_audit_user ON public.entitlements_audit(user_id, created_at DESC);

GRANT SELECT ON public.entitlements_audit TO authenticated;
GRANT ALL ON public.entitlements_audit TO service_role;
ALTER TABLE public.entitlements_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ent_audit own read" ON public.entitlements_audit;
CREATE POLICY "ent_audit own read"
  ON public.entitlements_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

-- =====================================================================
-- 5. has_entitlement(user_id, feature)
--    Single source of truth used by every RLS gate.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_entitlement(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state text;
  v_country text;
  v_country_flag boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  -- webinars: always allowed (only "free" tool) regardless of state
  IF _feature = 'webinars' THEN RETURN true; END IF;

  SELECT account_state, country_of_residence
    INTO v_state, v_country
  FROM public.profiles WHERE user_id = _user_id;

  IF v_state IS NULL THEN RETURN false; END IF;

  -- Jurisdiction gate (only applies to specific features; today: follow_notify)
  IF v_country IS NOT NULL THEN
    SELECT enabled INTO v_country_flag
      FROM public.feature_flags_by_country
      WHERE country_code = v_country AND feature = _feature;
    IF v_country_flag IS NOT NULL AND v_country_flag = false THEN
      RETURN false;
    END IF;
  END IF;

  -- State gate: locked -> nothing but webinars; active/grace -> full member tools;
  -- balance_unknown -> retain last-known access (treated as access ON; safer than auto-lock).
  IF v_state = 'locked' THEN RETURN false; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.has_entitlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO authenticated, service_role;

-- =====================================================================
-- 6. resolve_account_state(...) — atomic state machine
--    Returns: jsonb { new_state, prev_state, transition, notify_topup }
-- =====================================================================
CREATE OR REPLACE FUNCTION public.resolve_account_state(
  _user_id uuid,
  _balance numeric,
  _balance_known boolean,
  _max_age_minutes int DEFAULT 10,
  _source text DEFAULT 'trading_layer'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.profiles%ROWTYPE;
  v_prev text;
  v_new text;
  v_notify boolean := false;
  v_now timestamptz := now();
  v_grace_started timestamptz;
  v_min_balance constant numeric := 100;
  v_grace_days constant int := 7;
  v_unknown_trust_hours constant int := 24;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'resolve_account_state: user_id required';
  END IF;

  SELECT * INTO r FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for %', _user_id;
  END IF;

  v_prev := r.account_state;
  v_grace_started := r.grace_started_at;

  IF NOT _balance_known THEN
    -- Stale / TL unreachable: keep last-known state unless we've been blind too long.
    IF r.last_balance_check_at IS NOT NULL
       AND r.last_balance_check_at > v_now - (v_unknown_trust_hours || ' hours')::interval THEN
      v_new := v_prev;
    ELSE
      v_new := v_prev;
      UPDATE public.profiles
        SET manual_review_flag = true,
            manual_review_reason = 'balance_unknown_beyond_trust_window'
        WHERE user_id = _user_id;
    END IF;
  ELSE
    -- Fresh, confirmed balance.
    IF _balance >= v_min_balance THEN
      v_new := 'active';
      v_grace_started := NULL;
    ELSE
      IF v_grace_started IS NULL THEN
        v_grace_started := v_now;
        v_new := 'grace';
        v_notify := (v_prev = 'active' OR v_prev = 'balance_unknown');
      ELSIF v_now >= v_grace_started + (v_grace_days || ' days')::interval THEN
        v_new := 'locked';
      ELSE
        v_new := 'grace';
      END IF;
    END IF;

    UPDATE public.profiles
      SET account_state = v_new,
          grace_started_at = CASE WHEN v_new = 'active' THEN NULL ELSE v_grace_started END,
          last_known_balance_usd = _balance,
          last_balance_check_at = v_now,
          last_balance_source = _source,
          manual_review_flag = false,
          manual_review_reason = NULL
      WHERE user_id = _user_id;
  END IF;

  IF v_prev IS DISTINCT FROM v_new OR _balance_known THEN
    INSERT INTO public.entitlements_audit(user_id, prev_state, new_state, prev_balance, new_balance, balance_known, reason, source)
    VALUES (_user_id, v_prev, v_new, r.last_known_balance_usd,
            CASE WHEN _balance_known THEN _balance ELSE NULL END,
            _balance_known,
            CASE WHEN v_prev IS DISTINCT FROM v_new THEN 'state_transition' ELSE 'periodic_refresh' END,
            _source);
  END IF;

  RETURN jsonb_build_object(
    'prev_state', v_prev,
    'new_state', v_new,
    'transition', (v_prev IS DISTINCT FROM v_new),
    'notify_topup', v_notify,
    'grace_started_at', v_grace_started,
    'grace_lock_at', CASE WHEN v_grace_started IS NOT NULL
                          THEN v_grace_started + (v_grace_days || ' days')::interval END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_account_state(uuid, numeric, boolean, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_account_state(uuid, numeric, boolean, int, text) TO service_role;

-- =====================================================================
-- 7. RLS gates on member tools (WRITE-side; preserves existing SELECTs)
--    For each table we add an extra WITH CHECK requirement via a new policy
--    that runs alongside the existing ones. Postgres policies for the same
--    command are OR'd on USING; for WITH CHECK they are AND'd — so we layer
--    a single restrictive policy where needed.
-- =====================================================================

-- 7a. follows: jurisdiction-gated for follow_notify. Block both read & write
-- so a BR user can't bypass UI to subscribe OR observe a subscription row.
DROP POLICY IF EXISTS "follows entitlement gate" ON public.follows;
CREATE POLICY "follows entitlement gate"
  ON public.follows AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.has_entitlement(auth.uid(),'follow_notify'))
  WITH CHECK (public.has_entitlement(auth.uid(),'follow_notify'));

-- 7b. messages: posting requires community entitlement
DROP POLICY IF EXISTS "messages entitlement write gate" ON public.messages;
CREATE POLICY "messages entitlement write gate"
  ON public.messages AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_entitlement(auth.uid(),'community'));

-- 7c. trade_journal: writing requires journal entitlement
DROP POLICY IF EXISTS "trade_journal entitlement write gate" ON public.trade_journal;
CREATE POLICY "trade_journal entitlement write gate"
  ON public.trade_journal AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_entitlement(auth.uid(),'journal'));

DROP POLICY IF EXISTS "trade_journal entitlement update gate" ON public.trade_journal;
CREATE POLICY "trade_journal entitlement update gate"
  ON public.trade_journal AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_entitlement(auth.uid(),'journal'))
  WITH CHECK (public.has_entitlement(auth.uid(),'journal'));

-- 7d. trading_signals: publishing requires signals entitlement
DROP POLICY IF EXISTS "trading_signals entitlement write gate" ON public.trading_signals;
CREATE POLICY "trading_signals entitlement write gate"
  ON public.trading_signals AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_entitlement(auth.uid(),'signals'));

-- 7e. mt_pending_orders: placing/modifying live orders requires terminal_live
DROP POLICY IF EXISTS "mt_pending_orders entitlement write gate" ON public.mt_pending_orders;
CREATE POLICY "mt_pending_orders entitlement write gate"
  ON public.mt_pending_orders AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.has_entitlement(auth.uid(),'terminal_live'))
  WITH CHECK (public.has_entitlement(auth.uid(),'terminal_live'));

-- =====================================================================
-- 8. pg_cron sweep every 15 min
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('entitlements-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'entitlements-sweep',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://oyzbftsjlmucmvnjuadl.supabase.co/functions/v1/entitlements-sweep',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.cron_anon_key', true)
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $cron$
);
