
UPDATE public.lifecycle_validation_authorisations
SET status = 'failed_close_under_investigation',
    classification = 'controlled_close_broker_rejected_wrong_execution_route',
    failure_reason = 'close dispatched using trader_id (29008868-d583-4ab5-a6c1-57586fe92007) instead of verified route account_id (559a12e4-16d8-4db3-be48-40fbea54bcfe); TL retcode 10017 TRADE_RETCODE_TRADE_DISABLED; requestId 5a07cdb9-f8d3-4109-ad16-62f4f812f367; position 1169166422 manually closed in MT5; residual EURUSD exposure = none',
    updated_at = now()
WHERE id = 'be5b0c0a-e8fb-4b5c-8579-eba0e01f7955';

INSERT INTO public.site_settings (key, value)
VALUES (
  'lifecycle_close_route_incident_be5b0c0a',
  jsonb_build_object(
    'authorisationId','be5b0c0a-e8fb-4b5c-8579-eba0e01f7955',
    'entryResult','pass',
    'controlledCloseResult','failed_broker_rejected',
    'fullLifecycleResult','failed_controlled_close_validation',
    'lifecyclePassed', false,
    'reusable', false,
    'additionalEntryDispatchesPermitted', false,
    'additionalCloseDispatchesPermitted', false,
    'brokerCloseMutationDispatched', true,
    'closeRejectedByTradingLayer', true,
    'closeFailureRootCause','close_dispatched_using_trader_id_instead_of_verified_route_account_id',
    'rejectedRouteAccountId','29008868-d583-4ab5-a6c1-57586fe92007',
    'requiredVerifiedRouteAccountId','559a12e4-16d8-4db3-be48-40fbea54bcfe',
    'closeRequestId','5a07cdb9-f8d3-4109-ad16-62f4f812f367',
    'closeRetcode', 10017,
    'closeRetcodeName','TRADE_RETCODE_TRADE_DISABLED',
    'closeRetcodeDescription','Trade is disabled',
    'manualEmergencyCloseConfirmed', true,
    'currentOpenEurusdPositions', 0,
    'currentPendingEurusdOrders', 0,
    'residualEurusdExposure', false,
    'finalActivationBlocker', true,
    'recordedAt', now()
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
