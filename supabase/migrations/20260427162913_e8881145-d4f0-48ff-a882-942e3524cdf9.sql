-- Education module completion tracking
CREATE TABLE IF NOT EXISTS public.education_modules_completed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_slug TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, module_slug)
);

ALTER TABLE public.education_modules_completed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own module completions"
  ON public.education_modules_completed FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own module completions"
  ON public.education_modules_completed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own module completions"
  ON public.education_modules_completed FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all module completions"
  ON public.education_modules_completed FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_edu_completions_user ON public.education_modules_completed(user_id);

-- Seed module badges (8) + tier milestones (4)
INSERT INTO public.badges (slug, name, description, icon, tier, xp_reward) VALUES
  ('edu_getting_started',    'Getting Started',         'Completed the Getting Started module',                'rocket',           'bronze', 50),
  ('edu_macro_analysis',     'Macro Strategist',        'Completed the Macro Analysis module',                 'globe',            'bronze', 50),
  ('edu_technical_analysis', 'Chart Reader',            'Completed the Technical Analysis module',             'candlestick-chart','silver', 75),
  ('edu_chart_patterns',     'Pattern Hunter',          'Completed the Chart Patterns module',                 'activity',         'silver', 75),
  ('edu_risk_psychology',    'Iron Discipline',         'Completed Risk Management & Trading Psychology',      'shield-check',     'silver', 75),
  ('edu_trading_strategies', 'Strategy Architect',      'Completed the Trading Strategies module',             'target',           'gold',   100),
  ('edu_advanced_topics',    'Market Specialist',       'Completed Advanced Topics (Harmonics & Elliott)',     'sparkles',         'gold',   100),
  ('edu_video_library',      'Webinar Scholar',         'Completed the Webinars & Video Library module',       'video',            'bronze', 50),
  ('edu_milestone_bronze',   'Curriculum Initiate',     'Completed 25% of the Education Center',               'medal',            'bronze', 100),
  ('edu_milestone_silver',   'Curriculum Apprentice',   'Completed 50% of the Education Center',               'award',            'silver', 200),
  ('edu_milestone_gold',     'Curriculum Expert',       'Completed 75% of the Education Center',               'trophy',            'gold',   300),
  ('edu_graduate',           'Elite Graduate',          'Completed every Education module',                    'graduation-cap',   'gold',   500)
ON CONFLICT (slug) DO NOTHING;

-- Function to complete a module: records completion, awards XP, grants module badge,
-- evaluates tier milestones based on % of 8 modules completed.
CREATE OR REPLACE FUNCTION public.complete_education_module(_module_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_total_modules INTEGER := 8;
  v_already BOOLEAN;
  v_completed_count INTEGER;
  v_pct INTEGER;
  v_module_badge_id UUID;
  v_module_xp INTEGER := 50;
  v_new_badges TEXT[] := ARRAY[]::TEXT[];
  v_milestone_slug TEXT;
  v_milestone_id UUID;
  v_milestone_xp INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM education_modules_completed
    WHERE user_id = v_user AND module_slug = _module_slug
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('already_completed', true, 'new_badges', '[]'::jsonb);
  END IF;

  -- Insert completion + award XP
  INSERT INTO education_modules_completed (user_id, module_slug, xp_awarded)
  VALUES (v_user, _module_slug, v_module_xp);

  PERFORM award_xp(v_user, v_module_xp, 'education_module', jsonb_build_object('module_slug', _module_slug));

  -- Grant module-specific badge if it exists
  SELECT id INTO v_module_badge_id FROM badges WHERE slug = 'edu_' || REPLACE(_module_slug, '-', '_');
  IF v_module_badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (v_user, v_module_badge_id)
    ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'edu_' || REPLACE(_module_slug, '-', '_'));
  END IF;

  -- Calculate progress + tier milestones
  SELECT COUNT(*) INTO v_completed_count
  FROM education_modules_completed WHERE user_id = v_user;

  v_pct := (v_completed_count * 100) / v_total_modules;

  FOR v_milestone_slug, v_milestone_xp IN
    SELECT s, xp FROM (VALUES
      ('edu_milestone_bronze', 25, 100),
      ('edu_milestone_silver', 50, 200),
      ('edu_milestone_gold',   75, 300),
      ('edu_graduate',         100, 500)
    ) AS m(s, threshold, xp)
    WHERE v_pct >= m.threshold
  LOOP
    SELECT id INTO v_milestone_id FROM badges WHERE slug = v_milestone_slug;
    IF v_milestone_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM user_badges WHERE user_id = v_user AND badge_id = v_milestone_id
    ) THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_user, v_milestone_id);
      PERFORM award_xp(v_user, v_milestone_xp, 'education_milestone', jsonb_build_object('badge', v_milestone_slug));
      v_new_badges := array_append(v_new_badges, v_milestone_slug);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'already_completed', false,
    'xp_awarded', v_module_xp,
    'completed_count', v_completed_count,
    'total_modules', v_total_modules,
    'percent', v_pct,
    'new_badges', to_jsonb(v_new_badges)
  );
END;
$$;

-- Allow undoing a completion (for users to reset)
CREATE OR REPLACE FUNCTION public.uncomplete_education_module(_module_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM education_modules_completed WHERE user_id = v_user AND module_slug = _module_slug;
  RETURN true;
END;
$$;