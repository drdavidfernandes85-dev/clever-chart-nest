
ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS symbol_catalogue_status text,
  ADD COLUMN IF NOT EXISTS symbol_catalogue_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS symbol_catalogue_version text,
  ADD COLUMN IF NOT EXISTS live_execution_block_code text,
  ADD COLUMN IF NOT EXISTS live_execution_block_reason text,
  ADD COLUMN IF NOT EXISTS live_execution_block_set_at timestamp with time zone;

-- Ensure broker_symbol_catalog has an account-local unique index for safety.
CREATE UNIQUE INDEX IF NOT EXISTS broker_symbol_catalog_local_account_symbol_key
  ON public.broker_symbol_catalog (local_mt_account_id, broker_symbol)
  WHERE local_mt_account_id IS NOT NULL;
