
-- 1) Add broker ticket / position id to trade_journal for robust idempotency
ALTER TABLE public.trade_journal
  ADD COLUMN IF NOT EXISTS broker_ticket text,
  ADD COLUMN IF NOT EXISTS broker_position_id text;

-- Unique per-user ticket: prevents duplicate inserts on retried syncs.
CREATE UNIQUE INDEX IF NOT EXISTS trade_journal_user_ticket_unique
  ON public.trade_journal (user_id, broker_ticket)
  WHERE broker_ticket IS NOT NULL;

CREATE INDEX IF NOT EXISTS trade_journal_user_position_idx
  ON public.trade_journal (user_id, broker_position_id)
  WHERE broker_position_id IS NOT NULL;

-- 2) Sync diagnostics column on trade_execution_logs
ALTER TABLE public.trade_execution_logs
  ADD COLUMN IF NOT EXISTS sync_meta jsonb;
