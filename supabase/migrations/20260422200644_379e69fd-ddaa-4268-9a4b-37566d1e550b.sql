-- ==================== SECURITY HARDENING ====================

-- user_xp: remove user write access; only award_xp (security definer) writes
DROP POLICY IF EXISTS "Users insert own xp row" ON public.user_xp;
DROP POLICY IF EXISTS "Users update own xp row" ON public.user_xp;

-- xp_events: remove user insert; only award_xp writes
DROP POLICY IF EXISTS "Authenticated can insert own xp events" ON public.xp_events;

-- user_badges: remove user self-insert; admins manage
DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;

-- user_roles: restrict broad SELECT
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- mute_list: restrict SELECT to admins + own row
DROP POLICY IF EXISTS "Authenticated can view mutes" ON public.mute_list;
CREATE POLICY "Users see own mute or admins see all"
  ON public.mute_list FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Storage: chat-attachments — remove broad listing, scope writes to owner
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat attachments" ON storage.objects;

CREATE POLICY "Public can read chat attachment files"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users upload own chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own chat attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==================== SOCIAL: FOLLOWS ====================
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view follows"
  ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ==================== SOCIAL: MESSAGE REACTIONS ====================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions visible to authenticated"
  ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users add own reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;

-- ==================== ANALYTICS: WEEKLY REPORTS ====================
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  summary TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reports"
  ON public.weekly_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all reports"
  ON public.weekly_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own reports"
  ON public.weekly_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);