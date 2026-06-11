CREATE TABLE public.reconciliation_captures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mt_login BIGINT,
  trader_id TEXT,
  source TEXT NOT NULL DEFAULT 'get-mt5-terminal-data',
  account_profit NUMERIC,
  positions_profit_sum NUMERIC,
  delta NUMERIC,
  tolerance NUMERIC,
  account_payload JSONB,
  positions_payload JSONB,
  context JSONB,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reconciliation_captures TO authenticated;
GRANT ALL ON public.reconciliation_captures TO service_role;

ALTER TABLE public.reconciliation_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reconciliation captures"
  ON public.reconciliation_captures FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages reconciliation captures"
  ON public.reconciliation_captures FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_reconciliation_captures_captured_at
  ON public.reconciliation_captures (captured_at DESC);
CREATE INDEX idx_reconciliation_captures_user
  ON public.reconciliation_captures (user_id, captured_at DESC);