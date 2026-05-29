DO $$
DECLARE
  v_policy_row public.site_settings%ROWTYPE;
  v_current jsonb;
  v_prev_state text;
  v_scope jsonb;
  v_audit_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_policy_row
  FROM public.site_settings
  WHERE key = 'limited_canary_policy'
  FOR UPDATE;

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
    'suspend_limited_canary_after_execution_incident',
    v_prev_state,
    'suspended_after_execution_incident',
    v_now,
    NULL,
    'system_incident_handler',
    'LIMITED_CANARY_V1_2026_05_29',
    v_scope,
    jsonb_build_object(
      'ack_incident_suspend', true,
      'reason', 'CANARY_AUTHORISED_SELL_BLOCKED_PRE_DISPATCH_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE'
    ),
    jsonb_build_object('open_positions', 0, 'pending_orders', 0, 'symbol', 'EURUSD',
                       'source', 'incident_handler_pre_repair_snapshot'),
    'Auto-suspended after authorised canary SELL was blocked pre-dispatch by ACCOUNT_TRADE_PERMISSION_UNAVAILABLE (resolver returned tradeAllowed=null). No Trading Layer mutation dispatched.'
  ) RETURNING id INTO v_audit_id;

  UPDATE public.site_settings
  SET value = (v_current
        || jsonb_build_object(
             'capability_state', 'suspended_after_execution_incident',
             'activated_at', 'null'::jsonb,
             'activated_by_user_id', 'null'::jsonb,
             'activated_by_display', 'null'::jsonb,
             'activation_audit_event_id', to_jsonb(v_audit_id),
             'activation_audit_evidence_status', to_jsonb('cleared_on_incident_suspend'::text),
             'operational_use_lock', jsonb_build_object(
                'locked', true,
                'code', 'CANARY_ENTRY_PRETRADE_PERMISSION_DIVERGENCE_UNDER_REVIEW',
                'engaged_at', to_jsonb(v_now),
                'reason', 'Authorised canary SELL blocked pre-dispatch by ACCOUNT_TRADE_PERMISSION_UNAVAILABLE; preview/submit divergence under review.'
             ),
             'last_state_change_at', to_jsonb(v_now),
             'last_state_change_by_display', to_jsonb('system_incident_handler'::text),
             'updated_at', to_jsonb(v_now)
           )),
      updated_at = v_now
  WHERE key = 'limited_canary_policy';
END $$;