-- Cross-isolate cache for Trading Layer last-known-good account/positions data.
-- Only the get-live-account edge function (service role) writes to this table.
-- Users never read or write directly; admins can inspect for diagnostics.
CREATE TABLE IF NOT EXISTS public.tl_account_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trader_id TEXT NOT NULL,
  account_data JSONB,
  account_updated_at TIMESTAMPTZ,
  positions_data JSONB,
  positions_updated_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, trader_id)
);

CREATE INDEX IF NOT EXISTS idx_tl_account_cache_user_trader
  ON public.tl_account_cache (user_id, trader_id);

ALTER TABLE public.tl_account_cache ENABLE ROW LEVEL SECURITY;

-- Admins-only visibility. Service role bypasses RLS for writes.
CREATE POLICY "Admins view tl_account_cache"
  ON public.tl_account_cache
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at on row changes.
CREATE TRIGGER trg_tl_account_cache_updated_at
  BEFORE UPDATE ON public.tl_account_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
