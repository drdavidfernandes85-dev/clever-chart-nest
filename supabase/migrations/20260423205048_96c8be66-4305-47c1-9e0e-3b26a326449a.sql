ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS metaapi_account_id text,
  ADD COLUMN IF NOT EXISTS region text DEFAULT 'new-york',
  ADD COLUMN IF NOT EXISTS last_error text;

DROP VIEW IF EXISTS public.user_mt_accounts_safe;

CREATE VIEW public.user_mt_accounts_safe AS
SELECT
  id,
  user_id,
  platform,
  account_type,
  broker_name,
  server_name,
  login,
  nickname,
  status,
  status_message,
  last_synced_at,
  last_error,
  balance,
  equity,
  margin,
  free_margin,
  margin_level,
  currency,
  leverage,
  metaapi_account_id,
  region,
  (investor_password_encrypted IS NOT NULL) AS has_password,
  created_at,
  updated_at
FROM public.user_mt_accounts;

GRANT SELECT ON public.user_mt_accounts_safe TO authenticated;