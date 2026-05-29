DO $$
DECLARE
  v_now timestamptz := now();
  v_policy_row public.site_settings%ROWTYPE;
  v_current jsonb;
  v_prev_state text;
  v_scope jsonb;
  v_audit_id uuid;
  v_lock jsonb;
BEGIN
  SELECT * INTO v_policy_row FROM public.site_settings
   WHERE key='limited_canary_policy' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_current := v_policy_row.value;
  v_prev_state := v_current->>'capability_state';
  IF v_prev_state <> 'active_limited_canary' THEN RETURN; END IF;

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
    NULL, 'system:migration_canary_pre_reactivation_verification_disable',
    'LIMITED_CANARY_V1_2026_05_29',
    v_scope,
    jsonb_build_object('ack_manual_disable', true,
      'reason', 'pre_audited_reactivation_verification_must_run_while_disabled'),
    jsonb_build_object('open_positions', 0, 'pending_orders', 0, 'symbol', 'EURUSD'),
    'Atomic disable: ticket-binding verification pass must run with canary disabled.'
  ) RETURNING id INTO v_audit_id;

  v_lock := jsonb_build_object(
    'locked', true,
    'code', 'CANARY_UI_SCOPE_MISMATCH_UNDER_REVIEW',
    'engaged_at', to_jsonb(v_now),
    'reason', 'Pre-audited-reactivation verification must run while canary is disabled'
  );

  UPDATE public.site_settings
     SET value = (v_current || jsonb_build_object(
            'capability_state', 'disabled_by_admin',
            'activated_at', 'null'::jsonb,
            'activated_by_user_id', 'null'::jsonb,
            'activated_by_display', 'null'::jsonb,
            'activation_audit_event_id', to_jsonb(v_audit_id),
            'activation_audit_evidence_status', to_jsonb('cleared_on_disable'::text),
            'operational_use_lock', v_lock,
            'last_state_change_at', to_jsonb(v_now),
            'last_state_change_by_user_id', 'null'::jsonb,
            'last_state_change_by_display', to_jsonb('system:migration_canary_pre_reactivation_verification_disable'::text),
            'updated_at', to_jsonb(v_now)
          )),
         updated_at = v_now
   WHERE key='limited_canary_policy'
     AND value->>'capability_state' = v_prev_state;
END $$;