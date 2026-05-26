
DROP INDEX IF EXISTS public.broker_symbol_catalog_account_symbol_uidx;

ALTER TABLE public.broker_symbol_catalog
  ADD CONSTRAINT broker_symbol_catalog_account_symbol_key
  UNIQUE (trading_layer_account_id, broker_symbol);
