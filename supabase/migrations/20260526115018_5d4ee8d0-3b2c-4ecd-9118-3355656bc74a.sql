
CREATE TABLE IF NOT EXISTS public.broker_symbol_catalog_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by uuid,
  user_id uuid,
  local_mt_account_id uuid,
  trading_layer_account_id text,
  trading_layer_trader_id text,
  mt5_login text,
  mt5_server text,
  sync_type text NOT NULL,
  requested_symbols text[],
  rows_received integer DEFAULT 0,
  pages_fetched integer DEFAULT 0,
  catalogue_complete boolean DEFAULT false,
  error_code text,
  error_message text,
  metadata jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_symbol_catalog_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage broker symbol syncs"
ON public.broker_symbol_catalog_syncs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
