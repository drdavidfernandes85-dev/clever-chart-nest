-- Tighten table-level privileges on five sensitive tables.
-- RLS policies are NOT modified. service_role, postgres, and sandbox_exec are untouched.

-- 1) Anon: no access at all on these tables.
REVOKE ALL ON
  public.user_mt_accounts,
  public.mt_webhook_tokens,
  public.user_roles,
  public.mt_positions,
  public.mt_account_snapshots
FROM anon;

-- 2+3) Authenticated: revoke everything, then re-grant exactly what's required.
REVOKE ALL ON
  public.user_mt_accounts,
  public.mt_webhook_tokens,
  public.user_roles,
  public.mt_positions,
  public.mt_account_snapshots
FROM authenticated;

-- Read-only tables (server/webhook writes only)
GRANT SELECT ON public.mt_positions         TO authenticated;
GRANT SELECT ON public.mt_account_snapshots TO authenticated;

-- Owner-managed tables (RLS scopes to own rows / admins)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mt_accounts  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mt_webhook_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles        TO authenticated;