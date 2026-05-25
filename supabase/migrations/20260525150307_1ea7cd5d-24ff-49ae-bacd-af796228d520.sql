CREATE TABLE IF NOT EXISTS public.broker_symbol_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trading_layer_trader_id TEXT NOT NULL,
  mt5_login TEXT,
  mt5_server TEXT,
  display_symbol TEXT NOT NULL,
  canonical_symbol TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  description TEXT,
  asset_class TEXT,
  digits INTEGER,
  contract_size NUMERIC,
  trade_mode TEXT,
  trade_eligible BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'trading_layer_symbols',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trading_layer_trader_id, broker_symbol)
);

CREATE INDEX IF NOT EXISTS idx_bsc_trader ON public.broker_symbol_catalog (trading_layer_trader_id);
CREATE INDEX IF NOT EXISTS idx_bsc_canonical ON public.broker_symbol_catalog (trading_layer_trader_id, canonical_symbol);

ALTER TABLE public.broker_symbol_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage broker symbol catalog"
ON public.broker_symbol_catalog
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view their own broker symbols"
ON public.broker_symbol_catalog
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_mt_accounts uma
    WHERE uma.user_id = auth.uid()
      AND uma.trading_layer_trader_id = public.broker_symbol_catalog.trading_layer_trader_id
  )
);

CREATE TRIGGER trg_bsc_updated_at
BEFORE UPDATE ON public.broker_symbol_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();