-- 1. user_mt_accounts: one row per connected MT4/MT5 account
CREATE TABLE public.user_mt_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('mt4','mt5')),
  account_type text NOT NULL DEFAULT 'demo' CHECK (account_type IN ('live','demo')),
  broker_name text NOT NULL,
  server_name text NOT NULL,
  login text NOT NULL,
  nickname text,
  -- Encrypted at rest via pgcrypto symmetric encryption.
  -- We never expose this column through the safe view.
  investor_password_encrypted bytea,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','syncing','connected','error','disconnected')),
  status_message text,
  last_synced_at timestamptz,
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  margin_level numeric,
  currency text DEFAULT 'USD',
  leverage integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, login, server_name)
);

CREATE INDEX idx_user_mt_accounts_user ON public.user_mt_accounts(user_id);

ALTER TABLE public.user_mt_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mt accounts"
  ON public.user_mt_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all mt accounts"
  ON public.user_mt_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own mt accounts"
  ON public.user_mt_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own mt accounts"
  ON public.user_mt_accounts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own mt accounts"
  ON public.user_mt_accounts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_mt_accounts_updated
  BEFORE UPDATE ON public.user_mt_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. mt_positions: currently open positions synced from the MT account
CREATE TABLE public.mt_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.user_mt_accounts(id) ON DELETE CASCADE,
  ticket text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  volume numeric NOT NULL,
  open_price numeric NOT NULL,
  current_price numeric,
  stop_loss numeric,
  take_profit numeric,
  swap numeric DEFAULT 0,
  commission numeric DEFAULT 0,
  profit numeric DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, ticket)
);

CREATE INDEX idx_mt_positions_user ON public.mt_positions(user_id);
CREATE INDEX idx_mt_positions_account ON public.mt_positions(account_id);

ALTER TABLE public.mt_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own positions"
  ON public.mt_positions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own positions"
  ON public.mt_positions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own positions"
  ON public.mt_positions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own positions"
  ON public.mt_positions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all positions"
  ON public.mt_positions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_mt_positions_updated
  BEFORE UPDATE ON public.mt_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. mt_account_snapshots: time-series of equity/balance for the equity curve
CREATE TABLE public.mt_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.user_mt_accounts(id) ON DELETE CASCADE,
  balance numeric NOT NULL,
  equity numeric NOT NULL,
  margin numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mt_snapshots_account_time ON public.mt_account_snapshots(account_id, recorded_at DESC);

ALTER TABLE public.mt_account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own snapshots"
  ON public.mt_account_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own snapshots"
  ON public.mt_account_snapshots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all snapshots"
  ON public.mt_account_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Safe view that EXCLUDES the encrypted password column
CREATE OR REPLACE VIEW public.user_mt_accounts_safe
WITH (security_invoker = true) AS
SELECT
  id, user_id, platform, account_type, broker_name, server_name, login, nickname,
  status, status_message, last_synced_at,
  balance, equity, margin, free_margin, margin_level, currency, leverage,
  created_at, updated_at,
  CASE WHEN investor_password_encrypted IS NOT NULL THEN true ELSE false END AS has_password
FROM public.user_mt_accounts;