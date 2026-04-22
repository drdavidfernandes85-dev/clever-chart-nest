
CREATE TABLE public.trade_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  position_size NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  pnl NUMERIC,
  r_multiple NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  setup_tag TEXT,
  notes TEXT,
  screenshot_url TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trades"
  ON public.trade_journal FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all trades"
  ON public.trade_journal FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own trades"
  ON public.trade_journal FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own trades"
  ON public.trade_journal FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own trades"
  ON public.trade_journal FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_trade_journal_user_opened ON public.trade_journal (user_id, opened_at DESC);

CREATE TRIGGER update_trade_journal_updated_at
BEFORE UPDATE ON public.trade_journal
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
