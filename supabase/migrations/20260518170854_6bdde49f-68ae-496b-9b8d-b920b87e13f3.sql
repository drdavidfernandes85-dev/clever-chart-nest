
-- 1. Block anonymous inserts into the webhook retry queue (SSRF risk).
DROP POLICY IF EXISTS "Anyone can enqueue failed webhook" ON public.webhook_retry_queue;
CREATE POLICY "Authenticated can enqueue failed webhook"
  ON public.webhook_retry_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    webhook_url IS NOT NULL
    AND length(webhook_url) > 0
    AND payload IS NOT NULL
    AND status = 'pending'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- 2. Explicit authenticated-only admin SELECT on newsletter subscribers.
DROP POLICY IF EXISTS "Only admins can view subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view subscribers"
  ON public.newsletter_subscribers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Drop duplicate storage policies on chat-attachments bucket.
DROP POLICY IF EXISTS "Users can upload their own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;

-- 4. Realtime channel authorization — restrict subscriptions.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to allowed topics" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to allowed topics"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- Public topics anyone signed in may listen to:
    realtime.topic() IN ('messages', 'channels', 'trading_signals', 'webinars')
    -- Personal user topic: realtime:user:<uid>
    OR realtime.topic() = ('user:' || auth.uid()::text)
  );

DROP POLICY IF EXISTS "Authenticated can broadcast to own topics" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to own topics"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() = ('user:' || auth.uid()::text)
  );
