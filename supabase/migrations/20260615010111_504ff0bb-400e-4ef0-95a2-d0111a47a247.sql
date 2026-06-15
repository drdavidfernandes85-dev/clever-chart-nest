
-- ============================================================================
--  LEAST-PRIVILEGE TABLE GRANTS (public schema) — v2
--  RLS POLICIES ARE NOT MODIFIED.
-- ============================================================================
--
-- NOTE on default privileges: pg_default_acl in this database carries two
-- entries that auto-grant ALL on new public tables to anon + authenticated:
-- one owned by `supabase_admin`, one owned by `postgres`. ALTER DEFAULT
-- PRIVILEGES can only be executed by the role that owns the entry (or a
-- superuser). On Lovable Cloud the migration runner is neither, so any
-- attempt to ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin / postgres
-- raises 42501. We therefore cannot strip those defaults from inside a
-- migration. New tables created later will still inherit broad client
-- grants; until the platform changes its defaults, every new public table
-- created by future migrations MUST include an explicit REVOKE block.
--
-- A standard tightening block for new tables is:
--   REVOKE ALL ON public.<t> FROM anon, authenticated;
--   GRANT  <only-what-policies-need> ON public.<t> TO authenticated;
--   GRANT  ALL ON public.<t> TO service_role;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Wipe existing client grants on every existing public table.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Per-table grants. Each table gets ONLY the commands its RLS policies
--    allow for that role. service_role / postgres are deliberately untouched.
-- ---------------------------------------------------------------------------

-- Admin live-execution config
GRANT SELECT, INSERT, UPDATE ON public.admin_live_execution_tests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_live_test_limits TO authenticated;

-- Anon-writable telemetry / capture endpoints
GRANT INSERT          ON public.analytics_events       TO anon;
GRANT SELECT, INSERT  ON public.analytics_events       TO authenticated;
GRANT INSERT          ON public.booking_requests       TO anon;
GRANT SELECT, INSERT  ON public.booking_requests       TO authenticated;
GRANT INSERT          ON public.newsletter_subscribers TO anon;
GRANT SELECT, INSERT  ON public.newsletter_subscribers TO authenticated;

-- Reference / catalog / channels / settings / role tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges                      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_symbol_catalog       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_symbol_catalog_syncs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels                    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges                 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_xp                     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mute_list                   TO authenticated;

-- Canary / lifecycle / retest workflow (admin-only INSERT/UPDATE policies)
GRANT SELECT, INSERT, UPDATE ON public.controlled_retest_authorisations    TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lifecycle_validation_authorisations TO authenticated;

-- Copy trading
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copy_subscriptions          TO authenticated;

-- Education
GRANT SELECT, INSERT, DELETE         ON public.education_modules_completed TO authenticated;

-- Follows
GRANT SELECT, INSERT, DELETE         ON public.follows                     TO authenticated;

-- Journal (writes performed by service_role for deals/sync_state)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_deal_tags           TO authenticated;
GRANT SELECT                         ON public.journal_deals               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_notes               TO authenticated;
GRANT SELECT                         ON public.journal_sync_state          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_tags                TO authenticated;

-- Mentor applications (users create+read own; admins manage)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_applications         TO authenticated;

-- Messaging / reactions
GRANT SELECT, INSERT, DELETE         ON public.message_reactions           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages                    TO authenticated;

-- MT account data
GRANT SELECT                         ON public.mt_account_snapshots        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mt_pending_orders           TO authenticated;
GRANT SELECT                         ON public.mt_positions                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mt_webhook_tokens           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mt_accounts            TO authenticated;

-- Notifications (created by SECURITY DEFINER triggers; users read/update/delete own)
GRANT SELECT, UPDATE, DELETE         ON public.notifications               TO authenticated;

-- Profiles / settings / signups
GRANT SELECT, INSERT, UPDATE         ON public.profiles                    TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.user_settings               TO authenticated;
GRANT SELECT, INSERT                 ON public.user_signups                TO authenticated;

-- Personalization
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_layouts      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_instruments   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_trade_presets          TO authenticated;

-- Risk settings (admins + users)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_risk_settings       TO authenticated;

-- Trading signals (admins/mods write; everyone authenticated reads)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_signals             TO authenticated;

-- Trade journal (user-owned)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_journal               TO authenticated;

-- Trading Layer cache (admin SELECT only)
GRANT SELECT                         ON public.tl_account_cache            TO authenticated;

-- Videos & webinars (admins write; authenticated read)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos                      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinars                    TO authenticated;

-- Weekly reports (user-owned reads + inserts)
GRANT SELECT, INSERT                 ON public.weekly_reports               TO authenticated;

-- XP events (read-only; awarded via SECURITY DEFINER award_xp)
GRANT SELECT                         ON public.xp_events                    TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Audit / security / integrity-log tables → SELECT only, no client writes.
--    Any existing client INSERT policies are intentionally overridden at the
--    grant layer: the server (service_role / SECURITY DEFINER functions) is
--    the sole writer of these append-only logs.
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.execution_audit_events       TO authenticated;
GRANT SELECT ON public.security_events              TO authenticated;
GRANT SELECT ON public.risk_setting_audit_logs      TO authenticated;
GRANT SELECT ON public.canary_activation_audit      TO authenticated;
GRANT SELECT ON public.trade_execution_logs         TO authenticated;
GRANT SELECT ON public.trading_layer_webhook_events TO authenticated;
GRANT SELECT ON public.reconciliation_captures      TO authenticated;
GRANT SELECT ON public.webhook_retry_queue          TO authenticated;
-- webhook_nonces: no client policies → no client grants (service_role only).
