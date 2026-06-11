
-- 1. Add first-class columns for SL/TP prices and MT login
ALTER TABLE public.execution_audit_events
  ADD COLUMN IF NOT EXISTS stop_loss_price numeric NULL,
  ADD COLUMN IF NOT EXISTS take_profit_price numeric NULL,
  ADD COLUMN IF NOT EXISTS mt_login bigint NULL;

CREATE INDEX IF NOT EXISTS idx_execution_audit_events_mt_login
  ON public.execution_audit_events (mt_login);

-- 2. Drop the client-side INSERT policy. Audit rows are written exclusively by
--    service-role server code (submit-best-execution-order, submit-pending-order).
--    Owner/admin SELECT policies are preserved.
DROP POLICY IF EXISTS "Users insert own execution audit" ON public.execution_audit_events;

-- Revoke any direct INSERT from authenticated/anon if present (no-op if not granted).
REVOKE INSERT ON public.execution_audit_events FROM authenticated;
REVOKE INSERT ON public.execution_audit_events FROM anon;

-- Ensure service_role retains full access (it does via role bypass, but be explicit).
GRANT ALL ON public.execution_audit_events TO service_role;
