CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_validation_one_active_per_account_idx
ON public.lifecycle_validation_authorisations
(mt5_login, mt5_server, route_account_id)
WHERE status IN (
  'armed',
  'entry_dispatch_consumed',
  'awaiting_position_confirmation',
  'position_confirmed_close_only',
  'close_dispatch_consumed',
  'awaiting_close_confirmation'
);