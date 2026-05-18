
DROP POLICY IF EXISTS "Authenticated can read chat attachments"      ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments listable by authenticated"   ON storage.objects;
