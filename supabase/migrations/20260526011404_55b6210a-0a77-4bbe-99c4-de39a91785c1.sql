
ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS mapping_status text,
  ADD COLUMN IF NOT EXISTS account_id_relationship_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignored_for_execution boolean NOT NULL DEFAULT false;

UPDATE public.user_mt_accounts
   SET mapping_status = 'valid',
       account_id_relationship_verified = true,
       ignored_for_execution = false,
       credential_status = 'validated',
       last_verified_at = now()
 WHERE login = '87943580'
   AND server_name = 'InfinoxLimited-MT5Live'
   AND trading_layer_account_id = '559a12e4-16d8-4db3-be48-40fbea54bcfe'
   AND trading_layer_trader_id  = '29008868-d583-4ab5-a6c1-57586fe92007';

UPDATE public.user_mt_accounts
   SET mapping_status = 'stale_ignored',
       ignored_for_execution = true,
       status = 'disconnected'
 WHERE login = '87943580'
   AND server_name = 'EA Webhook'
   AND trading_layer_account_id IS NULL
   AND trading_layer_trader_id IS NULL;
