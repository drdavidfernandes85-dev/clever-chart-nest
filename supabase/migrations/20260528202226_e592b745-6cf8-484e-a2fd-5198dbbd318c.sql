
UPDATE public.lifecycle_validation_authorisations
SET
  status = 'close_confirmed',
  classification = 'controlled_lifecycle_entry_and_close_confirmed',
  controlled_close_confirmed = true,
  lifecycle_passed = true,
  close_evidence = COALESCE(close_evidence, '{}'::jsonb) || jsonb_build_object(
    'reconciliation', jsonb_build_object(
      'source', 'operator_confirmed_native_mt5_and_retcode_10008_placed',
      'confirmedTicketClosed', true,
      'currentTicket', '1169599713',
      'routeAccountIdUsed', '559a12e4-16d8-4db3-be48-40fbea54bcfe',
      'expectedEndpoint', '/api/v1/accounts/559a12e4-16d8-4db3-be48-40fbea54bcfe/trades/send',
      'brokerSymbol', 'EURUSD',
      'currentOpenEurusdPositions', 0,
      'currentPendingEurusdOrders', 0,
      'residualEurusdExposure', 'none',
      'controlledEntryValidationStatus', 'passed',
      'controlledCloseValidationStatus', 'passed',
      'fullLifecycleStatus', 'passed',
      'reusable', false,
      'additionalEntryDispatchesPermitted', false,
      'additionalCloseDispatchesPermitted', false,
      'generalClientLiveExecution', 'disabled_pending_final_activation_review',
      'pendingOrdersEnabled', false,
      'reconciledAt', now()
    )
  ),
  failure_reason = NULL,
  updated_at = now()
WHERE id = '66a010b9-1dfc-4f13-9acc-91bd0032d1c5'
  AND status = 'awaiting_close_confirmation'
  AND confirmed_position_ticket = '1169599713';

INSERT INTO public.site_settings(key, value)
VALUES (
  'lifecycle_pass_66a010b9',
  jsonb_build_object(
    'authorisationId', '66a010b9-1dfc-4f13-9acc-91bd0032d1c5',
    'ticket', '1169599713',
    'routeAccountId', '559a12e4-16d8-4db3-be48-40fbea54bcfe',
    'brokerSymbol', 'EURUSD',
    'entryOrderId', '1169599713',
    'entryRequestId', '20879598-85a8-418a-8e20-b990f6bf3430',
    'closeOrderId', '1169599737',
    'closeRetcode', 10008,
    'closeRetcodeName', 'TRADE_RETCODE_PLACED',
    'fullLifecycleStatus', 'passed',
    'historicalIncidentsPreserved', jsonb_build_array(
      'b53c4bca-2db3-48e3-ac1e-f89a462af877',
      'be5b0c0a-e8fb-4b5c-8579-eba0e01f7955',
      'd7bb8754-19bb-44c3-a034-5d85a0126da6',
      'e9b37fdd-33b4-4db2-81a8-81786981ee69'
    ),
    'generalClientLiveExecution', 'disabled_pending_final_activation_review',
    'pendingOrdersEnabled', false,
    'reconciledAt', now()
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
