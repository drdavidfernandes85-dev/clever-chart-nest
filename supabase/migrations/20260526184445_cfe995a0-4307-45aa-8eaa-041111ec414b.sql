
-- 1. Remove permissive INSERT on webhook_retry_queue (only admins/service role may enqueue)
DROP POLICY IF EXISTS "Authenticated can enqueue failed webhook" ON public.webhook_retry_queue;

-- 2. Remove user-facing DELETE on mt_positions (service role retains full access)
DROP POLICY IF EXISTS "Users delete own positions" ON public.mt_positions;

-- 3. Tighten risk_setting_audit_logs INSERT so users can't pollute others' audit trail
DROP POLICY IF EXISTS "Users insert own risk audit" ON public.risk_setting_audit_logs;
CREATE POLICY "Users insert own risk audit"
ON public.risk_setting_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (changed_by IS NULL OR changed_by = auth.uid())
);

-- 4. Lock down chat-attachments storage bucket
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

DROP POLICY IF EXISTS "Authenticated can read chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can read chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Users can upload own chat attachments" ON storage.objects;
CREATE POLICY "Users can upload own chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
