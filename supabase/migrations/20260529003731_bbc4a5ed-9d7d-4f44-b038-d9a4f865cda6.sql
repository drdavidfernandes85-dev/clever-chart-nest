CREATE OR REPLACE FUNCTION public.activate_limited_canary_audited(
  p_acknowledgements jsonb,
  p_policy_test_result jsonb,
  p_live_exposure_snapshot jsonb,
  p_route_audit_status text DEFAULT 'pass',
  p_broker_symbol_audit_status text DEFAULT 'pass'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_display text;
  v_policy_row public.site_settings%ROWTYPE;
  v_current jsonb;
  v_prev_state text;
  v_scope jsonb;
  v_audit_id uuid;
  v_now timestamptz := now();
  v_open integer;
  v_pending integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'CANARY_NOT_AUTHENTICATED';
  END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'CANARY_NOT_ADMIN';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  v_display := COALESCE(v_email, v_user::text);

  -- Atomically lock the policy row so concurrent activations cannot race.
  SELECT * INTO v_policy_row
  FROM public.site_settings
  WHERE key = 'limited_canary_policy'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANARY_POLICY_ROW_MISSING';
  END IF;

  v_current := v_policy_row.value;
  v_prev_state := v_current->>'capability_state';

  IF v_prev_state NOT IN (
    'disabled_by_admin_pending_audited_reactivation',
    'eligible_for_manual_activation',
    'disabled_by_admin'
  ) THEN
    RAISE EXCEPTION 'CANARY_INVALID_PREVIOUS_STATE: %', v_prev_state;
  END IF;

  -- Fresh zero-exposure requirement.
  v_open := COALESCE((p_live_exposure_snapshot->>'open_positions')::int, -1);
  v_pending := COALESCE((p_live_exposure_snapshot->>'pending_orders')::int, -1);
  IF v_open <> 0 OR v_pending <> 0 THEN
    RAISE EXCEPTION 'CANARY_FRESH_EXPOSURE_NOT_ZERO';
  END IF;

  -- Verified scope snapshot from authoritative policy row.
  v_scope := jsonb_build_object(
    'allowed_mt5_login', v_current->'allowed_mt5_login',
    'allowed_mt5_server', v_current->'allowed_mt5_server',
    'allowed_route_account_id', v_current->'allowed_route_account_id',
    'allowed_display_symbol', v_current->'allowed_display_symbol',
    'allowed_broker_symbol', v_current->'allowed_broker_symbol',
    'allowed_entry_operation', v_current->'allowed_entry_operation',
    'allowed_entry_volume', v_current->'allowed_entry_volume',
    'allowed_close_operation', v_current->'allowed_close_operation',
    'release_scope', v_current->'release_scope'
  );

  -- Require verified canary route + EURUSD.
  IF v_scope->>'allowed_route_account_id' <> '559a12e4-16d8-4db3-be48-40fbea54bcfe' THEN
    RAISE EXCEPTION 'CANARY_ROUTE_NOT_VERIFIED';
  END IF;
  IF UPPER(COALESCE(v_scope->>'allowed_broker_symbol','')) <> 'EURUSD' THEN
    RAISE EXCEPTION 'CANARY_BROKER_SYMBOL_NOT_EURUSD';
  END IF;

  -- Insert immutable audit row.
  INSERT INTO public.canary_activation_audit (
    action, previous_state, new_state, changed_at,
    changed_by_user_id, changed_by_display, policy_version,
    scope_snapshot, acknowledgements, policy_test_result,
    route_audit_status, broker_symbol_audit_status, live_exposure_snapshot, notes
  ) VALUES (
    'activate_limited_canary', v_prev_state, 'active_limited_canary', v_now,
    v_user, v_display, 'LIMITED_CANARY_V1_2026_05_29',
    v_scope, p_acknowledgements, p_policy_test_result,
    p_route_audit_status, p_broker_symbol_audit_status, p_live_exposure_snapshot,
    'Atomic activation via activate_limited_canary_audited()'
  ) RETURNING id INTO v_audit_id;

  -- Update policy atomically. WHERE clause re-verifies previous state to defend
  -- against any second concurrent activation that slipped past the row lock.
  UPDATE public.site_settings
  SET value = (v_current
        || jsonb_build_object(
             'capability_state', 'active_limited_canary',
             'activated_at', to_jsonb(v_now),
             'activated_by_user_id', to_jsonb(v_user),
             'activated_by_display', to_jsonb(v_display),
             'activation_audit_event_id', to_jsonb(v_audit_id),
             'activation_audit_evidence_status', to_jsonb('complete_verified'::text),
             'operational_use_lock', jsonb_build_object('locked', false, 'code', NULL),
             'last_state_change_at', to_jsonb(v_now),
             'last_state_change_by_user_id', to_jsonb(v_user),
             'last_state_change_by_display', to_jsonb(v_display),
             'updated_at', to_jsonb(v_now)
           )),
      updated_at = v_now
  WHERE key = 'limited_canary_policy'
    AND value->>'capability_state' = v_prev_state
  RETURNING value INTO v_current;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'CANARY_CONCURRENT_TRANSITION_DETECTED';
  END IF;

  RETURN jsonb_build_object(
    'policy', v_current,
    'audit_event_id', v_audit_id,
    'changed_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_limited_canary_audited(jsonb,jsonb,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_limited_canary_audited(jsonb,jsonb,jsonb,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.disable_limited_canary_audited(
  p_reason text,
  p_live_exposure_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_display text;
  v_policy_row public.site_settings%ROWTYPE;
  v_current jsonb;
  v_prev_state text;
  v_scope jsonb;
  v_audit_id uuid;
  v_now timestamptz := now();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'CANARY_NOT_AUTHENTICATED';
  END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'CANARY_NOT_ADMIN';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  v_display := COALESCE(v_email, v_user::text);

  SELECT * INTO v_policy_row
  FROM public.site_settings
  WHERE key = 'limited_canary_policy'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANARY_POLICY_ROW_MISSING';
  END IF;

  v_current := v_policy_row.value;
  v_prev_state := v_current->>'capability_state';

  v_scope := jsonb_build_object(
    'allowed_mt5_login', v_current->'allowed_mt5_login',
    'allowed_route_account_id', v_current->'allowed_route_account_id',
    'allowed_broker_symbol', v_current->'allowed_broker_symbol',
    'allowed_entry_operation', v_current->'allowed_entry_operation',
    'allowed_entry_volume', v_current->'allowed_entry_volume',
    'release_scope', v_current->'release_scope'
  );

  INSERT INTO public.canary_activation_audit (
    action, previous_state, new_state, changed_at,
    changed_by_user_id, changed_by_display, policy_version,
    scope_snapshot, acknowledgements, live_exposure_snapshot, notes
  ) VALUES (
    'disable_limited_canary', v_prev_state, 'disabled_by_admin', v_now,
    v_user, v_display, 'LIMITED_CANARY_V1_2026_05_29',
    v_scope, jsonb_build_object('ack_manual_disable', true, 'reason', p_reason),
    p_live_exposure_snapshot,
    COALESCE(p_reason, 'Atomic disable via disable_limited_canary_audited()')
  ) RETURNING id INTO v_audit_id;

  UPDATE public.site_settings
  SET value = (v_current
        || jsonb_build_object(
             'capability_state', 'disabled_by_admin',
             'activated_at', 'null'::jsonb,
             'activated_by_user_id', 'null'::jsonb,
             'activated_by_display', 'null'::jsonb,
             'activation_audit_event_id', to_jsonb(v_audit_id),
             'activation_audit_evidence_status', to_jsonb('cleared_on_disable'::text),
             'operational_use_lock', jsonb_build_object(
                'locked', true,
                'code', 'CANARY_DISABLED_BY_ADMIN',
                'engaged_at', to_jsonb(v_now),
                'reason', COALESCE(p_reason,'Manual disable by admin')
             ),
             'last_state_change_at', to_jsonb(v_now),
             'last_state_change_by_user_id', to_jsonb(v_user),
             'last_state_change_by_display', to_jsonb(v_display),
             'updated_at', to_jsonb(v_now)
           )),
      updated_at = v_now
  WHERE key = 'limited_canary_policy'
    AND value->>'capability_state' = v_prev_state
  RETURNING value INTO v_current;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'CANARY_CONCURRENT_TRANSITION_DETECTED';
  END IF;

  RETURN jsonb_build_object(
    'policy', v_current,
    'audit_event_id', v_audit_id,
    'changed_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disable_limited_canary_audited(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disable_limited_canary_audited(text,jsonb) TO authenticated;