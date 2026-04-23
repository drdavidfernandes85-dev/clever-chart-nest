-- Enable realtime broadcasts for live MT data so the dashboard updates instantly
-- when the EA pushes a new payload.
ALTER TABLE public.user_mt_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.mt_positions REPLICA IDENTITY FULL;
ALTER TABLE public.mt_account_snapshots REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_mt_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_mt_accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mt_positions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mt_positions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mt_account_snapshots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mt_account_snapshots;
  END IF;
END $$;