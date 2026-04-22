
-- ============ user_xp ============
CREATE TABLE public.user_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "XP visible to everyone authenticated"
  ON public.user_xp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own xp row"
  ON public.user_xp FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own xp row"
  ON public.user_xp FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage xp"
  ON public.user_xp FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_xp_updated_at
  BEFORE UPDATE ON public.user_xp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ xp_events ============
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own xp events"
  ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert own xp events"
  ON public.xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all xp events"
  ON public.xp_events FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_xp_events_user_created ON public.xp_events(user_id, created_at DESC);

-- ============ badges ============
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  xp_reward INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges visible to authenticated"
  ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage badges"
  ON public.badges FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ user_badges ============
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view user_badges"
  ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own badges"
  ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage user_badges"
  ON public.user_badges FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);

-- ============ user_settings ============
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_digest_optin BOOLEAN NOT NULL DEFAULT true,
  digest_day INTEGER NOT NULL DEFAULT 1,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own settings"
  ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings"
  ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings"
  ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all settings"
  ON public.user_settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ mute_list ============
CREATE TABLE public.mute_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  reason TEXT,
  muted_until TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mute_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mutes"
  ON public.mute_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage mute list"
  ON public.mute_list FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ messages.deleted_at + block muted users ============
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Messages viewable by authenticated" ON public.messages;
CREATE POLICY "Messages viewable by authenticated"
  ON public.messages FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
CREATE POLICY "Users can insert own messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.mute_list m
      WHERE m.user_id = auth.uid()
        AND (m.muted_until IS NULL OR m.muted_until > now())
    )
  );

CREATE POLICY "Admins can delete any message"
  ON public.messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any message"
  ON public.messages FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ award_xp helper ============
CREATE OR REPLACE FUNCTION public.award_xp(
  _user_id UUID,
  _amount INTEGER,
  _source TEXT,
  _context JSONB DEFAULT '{}'::jsonb
)
RETURNS public.user_xp
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row public.user_xp;
  new_total INTEGER;
  new_level INTEGER;
BEGIN
  INSERT INTO public.user_xp (user_id, total_xp, level)
  VALUES (_user_id, GREATEST(_amount, 0), 1)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = public.user_xp.total_xp + _amount,
        last_activity_date = CURRENT_DATE,
        updated_at = now()
  RETURNING total_xp INTO new_total;

  -- Level curve: every 500 XP = 1 level
  new_level := GREATEST(1, 1 + (new_total / 500));
  UPDATE public.user_xp SET level = new_level WHERE user_id = _user_id
  RETURNING * INTO result_row;

  INSERT INTO public.xp_events (user_id, source, amount, context)
  VALUES (_user_id, _source, _amount, _context);

  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, JSONB) TO authenticated;

-- ============ Seed badges ============
INSERT INTO public.badges (slug, name, description, icon, tier, xp_reward) VALUES
  ('first_trade', 'First Trade', 'Logged your first trade in the journal.', 'TrendingUp', 'bronze', 50),
  ('first_signal', 'Signal Spotter', 'Followed your first community signal.', 'Target', 'bronze', 50),
  ('ten_win_streak', '10-Win Streak', 'Won 10 trades in a row.', 'Flame', 'gold', 250),
  ('hundred_posts', 'Voice of the Room', 'Posted 100 messages in chat.', 'MessageSquare', 'silver', 150),
  ('mentor_pick', 'Mentor Pick', 'Highlighted by a mentor for trade quality.', 'Star', 'gold', 300),
  ('week_warrior', 'Week Warrior', 'Active 7 days in a row.', 'Calendar', 'silver', 100),
  ('century', 'Century Club', 'Logged 100 trades.', 'Trophy', 'gold', 500),
  ('top_trader_30d', 'Top Trader 30D', 'Reached the top 3 of the 30-day leaderboard.', 'Crown', 'gold', 400)
ON CONFLICT (slug) DO NOTHING;
