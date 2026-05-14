CREATE TABLE public.trade_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID,
  signal_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  volume NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  classification TEXT,
  retcode INTEGER,
  retcode_description TEXT,
  comment TEXT,
  ticket TEXT,
  http_status INTEGER,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_execution_logs_user ON public.trade_execution_logs(user_id, created_at DESC);
CREATE INDEX idx_trade_execution_logs_signal ON public.trade_execution_logs(signal_id);

ALTER TABLE public.trade_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own execution logs"
  ON public.trade_execution_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own execution logs"
  ON public.trade_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all execution logs"
  ON public.trade_execution_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));