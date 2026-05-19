CREATE TABLE public.execution_audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  volume NUMERIC NOT NULL,
  status TEXT NOT NULL,
  outcome TEXT NOT NULL,
  requested_price NUMERIC,
  executed_price NUMERIC,
  slippage NUMERIC,
  latency_ms INTEGER,
  spread NUMERIC,
  bid NUMERIC,
  ask NUMERIC,
  broker_message TEXT,
  retcode INTEGER,
  reason TEXT,
  rule_violated TEXT,
  ticket TEXT,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.execution_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own execution audit"
  ON public.execution_audit_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own execution audit"
  ON public.execution_audit_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all execution audit"
  ON public.execution_audit_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_execution_audit_user_created
  ON public.execution_audit_events (user_id, created_at DESC);
CREATE INDEX idx_execution_audit_symbol
  ON public.execution_audit_events (user_id, symbol);
CREATE INDEX idx_execution_audit_status
  ON public.execution_audit_events (user_id, status);