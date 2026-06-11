
-- =========================================================================
-- PART 1: Lock down SECURITY DEFINER functions (linter reconciliation)
-- =========================================================================

-- Trigger-only / internal functions: revoke ALL execute from API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_signal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_chat_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_webinar_live() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_mentor_application_approval() FROM PUBLIC, anon, authenticated;

-- Client-callable education RPCs: revoke public, grant explicit authenticated.
REVOKE EXECUTE ON FUNCTION public.complete_education_module(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.uncomplete_education_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_education_module(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncomplete_education_module(text) TO authenticated;

-- =========================================================================
-- PART 2: Journal tags
-- =========================================================================
CREATE TABLE public.journal_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#FFCD05',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_tags TO authenticated;
GRANT ALL ON public.journal_tags TO service_role;
ALTER TABLE public.journal_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags" ON public.journal_tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_journal_tags_updated_at
  BEFORE UPDATE ON public.journal_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- PART 3: Deal <-> Tag join
-- =========================================================================
CREATE TABLE public.journal_deal_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.journal_deals(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.journal_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_deal_tags TO authenticated;
GRANT ALL ON public.journal_deal_tags TO service_role;
ALTER TABLE public.journal_deal_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deal tags" ON public.journal_deal_tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX journal_deal_tags_deal_idx ON public.journal_deal_tags(deal_id);
CREATE INDEX journal_deal_tags_tag_idx ON public.journal_deal_tags(tag_id);

-- =========================================================================
-- PART 4: Position notes (one row per (user, mt_login, position_id))
-- =========================================================================
CREATE TABLE public.journal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mt_login text NOT NULL,
  position_id text NOT NULL,
  note text NOT NULL DEFAULT '',
  emotion text,
  setup text,
  rating smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mt_login, position_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_notes TO authenticated;
GRANT ALL ON public.journal_notes TO service_role;
ALTER TABLE public.journal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.journal_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_journal_notes_updated_at
  BEFORE UPDATE ON public.journal_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX journal_notes_user_pos_idx ON public.journal_notes(user_id, mt_login, position_id);
