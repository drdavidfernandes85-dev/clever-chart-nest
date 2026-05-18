ALTER TABLE public.user_mt_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.mt_positions REPLICA IDENTITY FULL;
ALTER TABLE public.trade_execution_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_mt_accounts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mt_positions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_execution_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;