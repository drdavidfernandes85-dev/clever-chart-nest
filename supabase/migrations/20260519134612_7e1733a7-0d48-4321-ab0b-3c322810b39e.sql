
CREATE TABLE IF NOT EXISTS public.trading_risk_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  live_trading_enabled boolean NOT NULL DEFAULT true,
  kill_switch_enabled boolean NOT NULL DEFAULT false,
  testing_mode_enabled boolean NOT NULL DEFAULT true,
  max_order_volume numeric NOT NULL DEFAULT 0.01,
  max_close_volume numeric NOT NULL DEFAULT 0.01,
  max_daily_volume numeric NOT NULL DEFAULT 0.05,
  max_daily_trades integer NOT NULL DEFAULT 5,
  max_daily_loss numeric NOT NULL DEFAULT 50,
  allowed_symbols text[] DEFAULT NULL,
  blocked_symbols text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trading_risk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own risk settings" ON public.trading_risk_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own risk settings" ON public.trading_risk_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own risk settings" ON public.trading_risk_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all risk settings" ON public.trading_risk_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage risk settings" ON public.trading_risk_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trading_risk_settings_set_updated_at
  BEFORE UPDATE ON public.trading_risk_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.risk_setting_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_by uuid,
  setting_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_setting_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own risk audit" ON public.risk_setting_audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own risk audit" ON public.risk_setting_audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() = changed_by);
CREATE POLICY "Admins view all risk audit" ON public.risk_setting_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS risk_setting_audit_logs_user_id_idx
  ON public.risk_setting_audit_logs(user_id, created_at DESC);
