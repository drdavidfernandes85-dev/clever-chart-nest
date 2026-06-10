-- Enable pending-order, cancel-pending, and modify SL/TP capabilities in the
-- Limited Canary policy. The edge functions for these operations previously
-- hard-returned 403 regardless of policy; they now read these switches from
-- site_settings.limited_canary_policy. This merge preserves every other field
-- of the persisted policy (activation evidence, allowlist scope, etc.).
-- All remaining gates stay in force: live-execution admin allowlist, risk
-- kill switch, admin_live_test_limits volume caps, broker-symbol eligibility,
-- and fresh trade-mode checks.
UPDATE public.site_settings
SET value = value || '{"pending_orders":"enabled","cancel_pending_orders":"enabled","modify_sl_tp":"enabled"}'::jsonb,
    updated_at = now()
WHERE key = 'limited_canary_policy';

-- If the policy row does not exist yet, seed it with only the capability
-- switches. loadCanaryPolicy() merges this over fail-closed defaults, so the
-- canary itself stays inactive (capability_state defaults to
-- eligible_for_manual_activation) until an admin activates it.
INSERT INTO public.site_settings (key, value)
SELECT 'limited_canary_policy',
       '{"pending_orders":"enabled","cancel_pending_orders":"enabled","modify_sl_tp":"enabled"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_settings WHERE key = 'limited_canary_policy'
);
