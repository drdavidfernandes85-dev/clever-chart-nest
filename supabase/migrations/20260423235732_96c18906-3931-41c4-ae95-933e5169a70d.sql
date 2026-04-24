-- Pending orders table: dashboard pushes orders here, EA polls + executes
CREATE TABLE public.mt_pending_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID,                        -- optional link to user_mt_accounts row
  signal_id UUID,                         -- optional reference to trading_signals.id
  symbol TEXT NOT NULL,                   -- broker symbol e.g. "EURUSD" or "XAUUSD"
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  order_type TEXT NOT NULL DEFAULT 'market' CHECK (order_type IN ('market','limit')),
  volume NUMERIC NOT NULL CHECK (volume > 0 AND volume <= 100),
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','executed','failed','cancelled')),
  ea_ticket TEXT,                         -- broker ticket once executed
  ea_message TEXT,                        -- error or confirmation text from EA
  fetched_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mt_pending_orders_user ON public.mt_pending_orders(user_id, status, created_at DESC);
CREATE INDEX idx_mt_pending_orders_status ON public.mt_pending_orders(status, created_at);

ALTER TABLE public.mt_pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pending orders"
  ON public.mt_pending_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pending orders"
  ON public.mt_pending_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending orders"
  ON public.mt_pending_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own pending orders"
  ON public.mt_pending_orders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all pending orders"
  ON public.mt_pending_orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER mt_pending_orders_set_updated_at
  BEFORE UPDATE ON public.mt_pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime so the UI updates when EA confirms
ALTER PUBLICATION supabase_realtime ADD TABLE public.mt_pending_orders;