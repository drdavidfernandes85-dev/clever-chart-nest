
ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS account_route_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_route_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_route_mt5_login text,
  ADD COLUMN IF NOT EXISTS account_route_mt5_server text,
  ADD COLUMN IF NOT EXISTS trading_layer_account_route_id text,
  ADD COLUMN IF NOT EXISTS account_route_verification_evidence jsonb;

ALTER TABLE public.broker_symbol_catalog
  ADD COLUMN IF NOT EXISTS execution_usable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_account_route_id text,
  ADD COLUMN IF NOT EXISTS mapping_status text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Quarantine every existing row until the source route is verified.
UPDATE public.broker_symbol_catalog
   SET execution_usable = false,
       route_identity_verified = false,
       mapping_status = 'route_unverified_or_wrong_account',
       notes = COALESCE(notes,
         'Catalogue returned without verified MT5 broker-symbol configuration; do not use for execution until account-route identity is verified.')
 WHERE route_identity_verified = false;
