-- One row per user; stores a sha256 hash of the secret token they paste into their EA.
CREATE TABLE public.mt_webhook_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL, -- first 8 chars of the raw token, shown in UI as a hint
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX mt_webhook_tokens_hash_idx ON public.mt_webhook_tokens(token_hash);
CREATE INDEX mt_webhook_tokens_user_active_idx
  ON public.mt_webhook_tokens(user_id) WHERE revoked_at IS NULL;

ALTER TABLE public.mt_webhook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook tokens"
ON public.mt_webhook_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own webhook tokens"
ON public.mt_webhook_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own webhook tokens"
ON public.mt_webhook_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own webhook tokens"
ON public.mt_webhook_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all webhook tokens"
ON public.mt_webhook_tokens FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));