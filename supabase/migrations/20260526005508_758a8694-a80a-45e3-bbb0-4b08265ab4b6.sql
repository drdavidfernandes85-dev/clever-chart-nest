
-- Extend broker_symbol_catalog with account-scoped, completeness, and freshness metadata
ALTER TABLE public.broker_symbol_catalog
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS local_mt_account_id uuid,
  ADD COLUMN IF NOT EXISTS chart_symbol text,
  ADD COLUMN IF NOT EXISTS volume_min numeric,
  ADD COLUMN IF NOT EXISTS volume_max numeric,
  ADD COLUMN IF NOT EXISTS volume_step numeric,
  ADD COLUMN IF NOT EXISTS trade_mode_raw text,
  ADD COLUMN IF NOT EXISTS trade_mode_interpretation text,
  ADD COLUMN IF NOT EXISTS catalogue_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS stale_at timestamptz;

-- Replace the old (trader, broker_symbol) uniqueness with account-scoped uniqueness.
-- Multiple broker variants for the same canonical symbol are now allowed per account.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broker_symbol_catalog_trading_layer_trader_id_broker_symbol_key'
  ) THEN
    ALTER TABLE public.broker_symbol_catalog
      DROP CONSTRAINT broker_symbol_catalog_trading_layer_trader_id_broker_symbol_key;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS broker_symbol_catalog_account_symbol_uidx
  ON public.broker_symbol_catalog (trading_layer_account_id, broker_symbol)
  WHERE trading_layer_account_id IS NOT NULL;

-- Keep legacy fallback so resolver can still match rows that only have trader id
CREATE INDEX IF NOT EXISTS broker_symbol_catalog_trader_idx
  ON public.broker_symbol_catalog (trading_layer_trader_id);

CREATE INDEX IF NOT EXISTS broker_symbol_catalog_user_idx
  ON public.broker_symbol_catalog (user_id);

-- Tighten user-visible RLS: a user can read rows belonging to one of their own connected accounts.
DROP POLICY IF EXISTS "Users view their own broker symbols" ON public.broker_symbol_catalog;
CREATE POLICY "Users view their own broker symbols"
  ON public.broker_symbol_catalog
  FOR SELECT
  TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_mt_accounts uma
      WHERE uma.user_id = auth.uid()
        AND (
          (uma.trading_layer_account_id IS NOT NULL
            AND uma.trading_layer_account_id = broker_symbol_catalog.trading_layer_account_id)
          OR
          (uma.trading_layer_trader_id IS NOT NULL
            AND uma.trading_layer_trader_id = broker_symbol_catalog.trading_layer_trader_id)
        )
    )
  );

-- Persist exact broker symbol on positions and pending orders so position-scoped
-- actions (close, partial close, modify SL/TP, cancel) always submit the right symbol.
ALTER TABLE public.mt_positions
  ADD COLUMN IF NOT EXISTS broker_symbol text;

ALTER TABLE public.mt_pending_orders
  ADD COLUMN IF NOT EXISTS broker_symbol text;

CREATE INDEX IF NOT EXISTS mt_positions_broker_symbol_idx
  ON public.mt_positions (broker_symbol);

CREATE INDEX IF NOT EXISTS mt_pending_orders_broker_symbol_idx
  ON public.mt_pending_orders (broker_symbol);
