ALTER TABLE public.broker_symbol_catalog
  ADD COLUMN IF NOT EXISTS trading_layer_account_id text,
  ADD COLUMN IF NOT EXISTS source_endpoint_account_id text,
  ADD COLUMN IF NOT EXISTS source_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS broker_symbol_catalog_account_idx
  ON public.broker_symbol_catalog (trading_layer_account_id);

-- Mark existing rows as source_unverified — they were upserted using
-- traderId against the account-scoped /accounts/{id}/symbols endpoint.
UPDATE public.broker_symbol_catalog
SET source_verified = false,
    source_endpoint_account_id = NULL
WHERE source_endpoint_account_id IS NULL;