UPDATE public.lifecycle_validation_authorisations
SET
  status = 'position_confirmed_close_only',
  classification = 'lifecycle_entry_placed_position_confirmed_awaiting_controlled_close',
  failure_reason = NULL,
  maximum_entry_dispatches = 1,
  entry_dispatches_consumed = 1,
  maximum_close_dispatches = 1,
  close_dispatches_consumed = 0,
  entry_consumed_at = COALESCE(entry_consumed_at, now()),
  confirmed_position_ticket = '1169128468',
  confirmed_position_at = now(),
  confirmed_position_evidence = jsonb_build_object(
    'ticket','1169128468','symbol','EURUSD','broker_symbol','EURUSD',
    'side','sell','volume',0.01,
    'source','forensic_recovery_from_trading_layer_evidence'
  ),
  entry_order_id = '1169126422',
  entry_request_id = '493eedc1-cc46-49ac-8162-af771706f3bd',
  entry_retcode = 10008,
  entry_evidence = COALESCE(entry_evidence,'{}'::jsonb) || jsonb_build_object(
    'recoveryApplied', true,
    'recoveryReason', 'ui_misreport_corrected_with_tl_evidence',
    'brokerMutationDispatched', true,
    'mutationDispatched', true,
    'endpointPath', '/api/v1/accounts/559a12e4-16d8-4db3-be48-40fbea54bcfe/trades/send',
    'method', 'POST',
    'routeAccountId', '559a12e4-16d8-4db3-be48-40fbea54bcfe',
    'idempotencyKeyPresent', true,
    'retcode', 10008,
    'retcodeName', 'TRADE_RETCODE_PLACED',
    'retcodeDescription', 'Order placed',
    'classification', 'placed',
    'orderId', '1169126422',
    'requestId', '493eedc1-cc46-49ac-8162-af771706f3bd',
    'outboundBody', jsonb_build_object('side','sell','symbol','EURUSD','volume',0.01),
    'deviationAbsent', true,
    'internalMetadataExcluded', true,
    'confirmedPositionTicket', '1169128468'
  ),
  updated_at = now()
WHERE id = 'b53c4bca-2db3-48e3-ac1e-f89a462af877';