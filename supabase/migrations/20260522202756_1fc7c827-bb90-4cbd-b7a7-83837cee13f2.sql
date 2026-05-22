
-- =========================================================================
-- admin_live_execution_tests
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.admin_live_execution_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_user_id UUID NOT NULL,
  mt5_login TEXT,
  trading_layer_trader_id TEXT,
  test_type TEXT NOT NULL CHECK (test_type IN (
    'market_buy','market_sell','full_close','partial_close',
    'modify_sl','modify_tp','buy_limit','sell_limit','buy_stop','sell_stop',
    'cancel_pending','invert_position'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','pass','fail','skipped')),
  trade_id TEXT,
  client_order_id TEXT,
  client_close_id TEXT,
  request_id TEXT,
  order_id TEXT,
  deal_id TEXT,
  position_ticket TEXT,
  broker_symbol TEXT,
  side TEXT,
  requested_volume NUMERIC,
  confirmed_volume NUMERIC,
  confirmation_status TEXT,
  retcode INTEGER,
  retcode_name TEXT,
  retcode_description TEXT,
  latency_ms INTEGER,
  rate_limit_hit BOOLEAN NOT NULL DEFAULT false,
  duplicate_detected BOOLEAN NOT NULL DEFAULT false,
  account_id_mismatch BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  evidence_json JSONB,
  tested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alet_tester ON public.admin_live_execution_tests(tester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alet_test_type ON public.admin_live_execution_tests(test_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alet_trade_id ON public.admin_live_execution_tests(trade_id);

ALTER TABLE public.admin_live_execution_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view live tests"
  ON public.admin_live_execution_tests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert live tests"
  ON public.admin_live_execution_tests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update live tests"
  ON public.admin_live_execution_tests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_alet_updated_at
  BEFORE UPDATE ON public.admin_live_execution_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- admin_live_test_limits (single-row)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.admin_live_test_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_order_volume NUMERIC NOT NULL DEFAULT 0.01,
  max_simultaneous_test_positions INTEGER NOT NULL DEFAULT 1,
  max_daily_live_test_orders INTEGER NOT NULL DEFAULT 10,
  max_daily_test_loss_usd NUMERIC NOT NULL DEFAULT 50,
  pending_orders_enabled BOOLEAN NOT NULL DEFAULT false,
  partial_close_cap_increase_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_live_test_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage live test limits"
  ON public.admin_live_test_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_altl_updated_at
  BEFORE UPDATE ON public.admin_live_test_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_live_test_limits (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
