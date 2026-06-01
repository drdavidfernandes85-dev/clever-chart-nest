-- =====================================================
-- 1) Chat attachments: restrict reads to owner folder
-- =====================================================
DROP POLICY IF EXISTS "Authenticated can read chat attachments" ON storage.objects;

CREATE POLICY "Users read own chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- =====================================================
-- 2) mt_positions: remove user write policies
-- =====================================================
DROP POLICY IF EXISTS "Users insert own positions" ON public.mt_positions;
DROP POLICY IF EXISTS "Users update own positions" ON public.mt_positions;

CREATE POLICY "Service role manages positions"
ON public.mt_positions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 3) mt_account_snapshots: remove user insert policy
-- =====================================================
DROP POLICY IF EXISTS "Users insert own snapshots" ON public.mt_account_snapshots;

CREATE POLICY "Service role manages snapshots"
ON public.mt_account_snapshots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 4) Tighten SECURITY DEFINER function EXECUTE grants
-- =====================================================

-- Trigger-only functions: revoke from API roles entirely
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_signal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_webinar_live() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_chat_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_mentor_application_approval() FROM PUBLIC, anon, authenticated;

-- Admin-only canary functions: revoke anon, keep authenticated (admin check is inside)
REVOKE ALL ON FUNCTION public.activate_limited_canary_audited(jsonb, jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_limited_canary_audited(jsonb, jsonb, jsonb, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.disable_limited_canary_audited(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_limited_canary_audited(text, jsonb) TO authenticated;

-- Education / XP: signed-in users only; award_xp is internal (called by other definers)
REVOKE ALL ON FUNCTION public.complete_education_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_education_module(text) TO authenticated;

REVOKE ALL ON FUNCTION public.uncomplete_education_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uncomplete_education_module(text) TO authenticated;

REVOKE ALL ON FUNCTION public.award_xp(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;

-- has_role: must remain executable by authenticated since RLS policies invoke it
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;