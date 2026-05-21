ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS trading_layer_trader_id TEXT,
  ADD COLUMN IF NOT EXISTS trading_layer_account_id TEXT,
  ADD COLUMN IF NOT EXISTS credential_status TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_tl_error_code TEXT;

-- Backfill: existing rows used metaapi_account_id as the Trading Layer accountId.
UPDATE public.user_mt_accounts
   SET trading_layer_account_id = metaapi_account_id,
       trading_layer_trader_id  = COALESCE(trading_layer_trader_id, metaapi_account_id)
 WHERE metaapi_account_id IS NOT NULL
   AND (trading_layer_account_id IS NULL OR trading_layer_trader_id IS NULL);