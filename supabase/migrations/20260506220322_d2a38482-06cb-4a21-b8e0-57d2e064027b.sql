
-- 1. De-duplicate existing user_signups (keep earliest)
DELETE FROM public.user_signups a
USING public.user_signups b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- 2. Enforce uniqueness so client upsert is idempotent
ALTER TABLE public.user_signups
  ADD CONSTRAINT user_signups_user_id_key UNIQUE (user_id);

-- 3. Webhook retry queue
CREATE TABLE public.webhook_retry_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  webhook_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- Allow anyone (incl. anon, since signup may not have a session yet when email confirmation is on)
-- to log a failed webhook attempt for their own signup. Reads/updates restricted to admins.
CREATE POLICY "Anyone can enqueue failed webhook"
  ON public.webhook_retry_queue
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins view retry queue"
  ON public.webhook_retry_queue
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage retry queue"
  ON public.webhook_retry_queue
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete retry queue"
  ON public.webhook_retry_queue
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_webhook_retry_queue_updated_at
  BEFORE UPDATE ON public.webhook_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_webhook_retry_queue_status ON public.webhook_retry_queue(status, next_retry_at);
