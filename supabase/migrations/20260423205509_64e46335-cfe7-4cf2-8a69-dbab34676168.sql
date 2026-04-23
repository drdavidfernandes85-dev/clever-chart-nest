ALTER TABLE public.user_mt_accounts
  ADD COLUMN IF NOT EXISTS metaapi_token_encrypted bytea;

DROP VIEW IF EXISTS public.user_mt_accounts_safe;

CREATE VIEW public.user_mt_accounts_safe
WITH (security_invoker = on) AS
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
  (metaapi_token_encrypted IS NOT NULL) AS has_metaapi_token,
  created_at,
  updated_at
FROM public.user_mt_accounts;

GRANT SELECT ON public.user_mt_accounts_safe TO authenticated;