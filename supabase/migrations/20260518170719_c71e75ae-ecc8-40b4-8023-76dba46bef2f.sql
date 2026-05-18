
-- 1. Tighten the 3 INSERT-with-true RLS policies (still public, but with basic input validation so it's not literally `true`).
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 3 AND 320 AND email LIKE '%_@_%');

DROP POLICY IF EXISTS "Anyone can submit a booking request" ON public.booking_requests;
CREATE POLICY "Anyone can submit a booking request"
  ON public.booking_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 3 AND 320 AND email LIKE '%_@_%' AND purpose IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can enqueue failed webhook" ON public.webhook_retry_queue;
CREATE POLICY "Anyone can enqueue failed webhook"
  ON public.webhook_retry_queue FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    webhook_url IS NOT NULL
    AND length(webhook_url) > 0
    AND payload IS NOT NULL
    AND status = 'pending'
  );

-- 2. Lock down SECURITY DEFINER functions so they're not callable from PostgREST
--    by anon / authenticated when they shouldn't be.
--    Trigger-only functions: revoke ALL execute privileges.
REVOKE ALL ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_mentor_application_approval()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_signal()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_chat_event()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_webinar_live()                   FROM PUBLIC, anon, authenticated;

--    Internal helper: should never be called directly by clients.
REVOKE ALL ON FUNCTION public.award_xp(uuid, integer, text, jsonb)    FROM PUBLIC, anon, authenticated;

--    RPCs that authenticated users legitimately need to call.
--    Keep authenticated EXECUTE, drop anon + public.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)             TO authenticated;

REVOKE ALL ON FUNCTION public.complete_education_module(text)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_education_module(text)      TO authenticated;

REVOKE ALL ON FUNCTION public.uncomplete_education_module(text)       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uncomplete_education_module(text)    TO authenticated;

-- 3. Public storage bucket listing: restrict chat-attachments listing to authenticated users.
--    Files are still publicly readable when fetched via direct URL (bucket stays public),
--    but anonymous users can no longer enumerate the bucket via storage.objects.
DROP POLICY IF EXISTS "chat-attachments listable by authenticated" ON storage.objects;
CREATE POLICY "chat-attachments listable by authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');
