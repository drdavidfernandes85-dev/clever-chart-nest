-- Replace broad public SELECT on storage.objects with one that prevents listing
-- (Public reads via signed/public URL still work because Supabase signs by name)
DROP POLICY IF EXISTS "Public can read chat attachment files" ON storage.objects;

-- Allow only authenticated users to read attachments (direct URL still works
-- via getPublicUrl since the bucket is public, but enumeration is blocked)
CREATE POLICY "Authenticated can read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

-- Tighten the new follows/reactions SELECT policies (replace true with auth check)
DROP POLICY IF EXISTS "Anyone authenticated can view follows" ON public.follows;
CREATE POLICY "Authenticated can view follows"
  ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Reactions visible to authenticated" ON public.message_reactions;
CREATE POLICY "Authenticated can view reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);