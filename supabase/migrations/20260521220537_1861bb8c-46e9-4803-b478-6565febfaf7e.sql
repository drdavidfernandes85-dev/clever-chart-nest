ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS trading_layer_external_trader_id TEXT;