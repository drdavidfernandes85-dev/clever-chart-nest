
-- security_events: audit log for auth/security incidents
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,            -- e.g. 'sso_bad_token', 'mt_webhook_bad_token', 'tl_webhook_bad_signature', 'tl_webhook_missing_secret', 'admin_role_mutation', 'jwt_invalid'
  severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','error','critical')),
  source TEXT NOT NULL,                -- function name or surface
  ip TEXT,
  user_agent TEXT,
  subject_email TEXT,
  subject_user_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view security events"
  ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX security_events_created_at_idx ON public.security_events (created_at DESC);
CREATE INDEX security_events_type_idx ON public.security_events (event_type, created_at DESC);

-- webhook_nonces: replay protection (jti/event-id dedup)
CREATE TABLE public.webhook_nonces (
  source TEXT NOT NULL,                -- 'trading_layer' | 'mt_webhook' | etc.
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, nonce)
);
GRANT ALL ON public.webhook_nonces TO service_role;
ALTER TABLE public.webhook_nonces ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (which bypasses RLS) can read/write.

CREATE INDEX webhook_nonces_expires_idx ON public.webhook_nonces (expires_at);
