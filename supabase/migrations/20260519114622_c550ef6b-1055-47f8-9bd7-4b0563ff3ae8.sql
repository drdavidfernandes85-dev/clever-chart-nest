-- Allow upsert by (user_id, broker_ticket) on trade_journal.
-- Partial unique index excludes rows where broker_ticket is null
-- (manually-added trades) so they don't collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS trade_journal_user_broker_ticket_uniq
  ON public.trade_journal (user_id, broker_ticket)
  WHERE broker_ticket IS NOT NULL;