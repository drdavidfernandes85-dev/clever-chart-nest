-- Phase 6: Trading Journal — raw deal store + shared position aggregation view.
-- journal_deals mirrors MT5 /history/deals rows 1:1. journal_positions is the
-- single math source consumed by Diario AND Dashboard (Part B).

CREATE TABLE IF NOT EXISTS public.journal_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  mt_account_id   UUID NOT NULL REFERENCES public.user_mt_accounts(id) ON DELETE CASCADE,
  mt_login        BIGINT NOT NULL,
  ticket          BIGINT NOT NULL,             -- MT5 deal id
  order_id        BIGINT,                      -- originating order
  position_id     BIGINT,                      -- groups deals into a position
  symbol          TEXT,
  type_raw        INTEGER NOT NULL,            -- ENUM_DEAL_TYPE (0=buy,1=sell,2..=non-trade)
  entry_raw       INTEGER,                     -- ENUM_DEAL_ENTRY (0=in,1=out,2=inout,3=out_by)
  is_trade        BOOLEAN NOT NULL,            -- type_raw in (0,1)
  side            TEXT,                        -- 'buy'|'sell'|null  (decoded)
  entry           TEXT,                        -- 'in'|'out'|'inout'|'out_by'|null
  volume          NUMERIC,
  price           NUMERIC,
  profit          NUMERIC NOT NULL DEFAULT 0,
  swap            NUMERIC NOT NULL DEFAULT 0,
  commission      NUMERIC NOT NULL DEFAULT 0,
  fee             NUMERIC NOT NULL DEFAULT 0,
  deal_time       TIMESTAMPTZ NOT NULL,        -- UTC
  comment         TEXT,
  reason_raw      INTEGER,
  raw             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mt_login, ticket)
);

CREATE INDEX IF NOT EXISTS idx_journal_deals_user_time
  ON public.journal_deals (user_id, deal_time DESC);
CREATE INDEX IF NOT EXISTS idx_journal_deals_user_login_pos
  ON public.journal_deals (user_id, mt_login, position_id);
CREATE INDEX IF NOT EXISTS idx_journal_deals_user_order
  ON public.journal_deals (user_id, order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_deals TO authenticated;
GRANT ALL ON public.journal_deals TO service_role;

ALTER TABLE public.journal_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own deals"
  ON public.journal_deals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages deals"
  ON public.journal_deals FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Admins view all deals"
  ON public.journal_deals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_journal_deals_updated_at
  BEFORE UPDATE ON public.journal_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync bookkeeping per account (cursor + last run).
CREATE TABLE IF NOT EXISTS public.journal_sync_state (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  mt_account_id      UUID NOT NULL REFERENCES public.user_mt_accounts(id) ON DELETE CASCADE,
  mt_login           BIGINT NOT NULL,
  last_synced_at     TIMESTAMPTZ,
  last_deal_time     TIMESTAMPTZ,
  last_deal_ticket   BIGINT,
  last_status        TEXT,
  last_error         TEXT,
  deals_total        INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mt_account_id)
);

GRANT SELECT ON public.journal_sync_state TO authenticated;
GRANT ALL ON public.journal_sync_state TO service_role;

ALTER TABLE public.journal_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sync state"
  ON public.journal_sync_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages sync state"
  ON public.journal_sync_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_journal_sync_state_updated_at
  BEFORE UPDATE ON public.journal_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PART B: shared aggregation view. SECURITY INVOKER so journal_deals RLS
-- (user_id = auth.uid()) applies naturally to every consumer. Both Diario
-- parent rows and the Dashboard MUST derive from this view.
CREATE OR REPLACE VIEW public.journal_positions
WITH (security_invoker = true) AS
WITH trade_deals AS (
  SELECT *
  FROM public.journal_deals
  WHERE is_trade = true AND position_id IS NOT NULL
),
first_in AS (
  SELECT DISTINCT ON (user_id, mt_login, position_id)
         user_id, mt_login, position_id, side AS open_side, symbol AS open_symbol
  FROM trade_deals
  WHERE entry = 'in' OR entry IS NULL
  ORDER BY user_id, mt_login, position_id, deal_time ASC, ticket ASC
),
agg AS (
  SELECT
    d.user_id,
    d.mt_account_id,
    d.mt_login,
    d.position_id,
    MAX(d.symbol)                                                   AS symbol_any,
    MIN(d.deal_time) FILTER (WHERE d.entry = 'in' OR d.entry IS NULL) AS open_time,
    MAX(d.deal_time) FILTER (WHERE d.entry IN ('out','out_by'))     AS close_time,
    COALESCE(SUM(d.volume) FILTER (WHERE d.entry = 'in' OR d.entry IS NULL), 0) AS volume_in,
    COALESCE(SUM(d.volume) FILTER (WHERE d.entry IN ('out','out_by')), 0)        AS volume_out,
    COALESCE(SUM(d.price * d.volume) FILTER (WHERE d.entry = 'in' OR d.entry IS NULL), 0) AS num_open,
    COALESCE(SUM(d.price * d.volume) FILTER (WHERE d.entry IN ('out','out_by')), 0)        AS num_close,
    COALESCE(SUM(d.profit + d.swap + d.commission + d.fee), 0)     AS net_pnl,
    COALESCE(SUM(d.profit), 0)                                      AS gross_profit,
    COALESCE(SUM(d.swap), 0)                                        AS swap_total,
    COALESCE(SUM(d.commission), 0)                                  AS commission_total,
    COALESCE(SUM(d.fee), 0)                                         AS fee_total,
    COUNT(*)                                                        AS deal_count,
    BOOL_OR(d.entry IN ('inout','out_by'))                          AS has_complex_entry
  FROM trade_deals d
  GROUP BY d.user_id, d.mt_account_id, d.mt_login, d.position_id
)
SELECT
  a.user_id,
  a.mt_account_id,
  a.mt_login,
  a.position_id,
  COALESCE(fi.open_symbol, a.symbol_any)                          AS symbol,
  fi.open_side                                                    AS side,
  a.open_time,
  CASE WHEN a.volume_out >= a.volume_in - 1e-9
       THEN a.close_time END                                      AS close_time,
  a.volume_in,
  a.volume_out,
  CASE WHEN a.volume_in  > 0 THEN a.num_open  / a.volume_in  END  AS vwap_open,
  CASE WHEN a.volume_out > 0 THEN a.num_close / a.volume_out END  AS vwap_close,
  (a.volume_out >= a.volume_in - 1e-9)                            AS is_closed,
  a.net_pnl,
  a.gross_profit,
  a.swap_total,
  a.commission_total,
  a.fee_total,
  a.deal_count,
  a.has_complex_entry
FROM agg a
LEFT JOIN first_in fi
  ON fi.user_id = a.user_id
 AND fi.mt_login = a.mt_login
 AND fi.position_id = a.position_id;

GRANT SELECT ON public.journal_positions TO authenticated;
GRANT SELECT ON public.journal_positions TO service_role;