
-- Copy-trading subscriptions
CREATE TABLE IF NOT EXISTS public.copy_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL,
  trader_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  risk_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, trader_id)
);
ALTER TABLE public.copy_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own copy subs" ON public.copy_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = subscriber_id OR auth.uid() = trader_id);
CREATE POLICY "Users insert own copy subs" ON public.copy_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "Users update own copy subs" ON public.copy_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = subscriber_id);
CREATE POLICY "Users delete own copy subs" ON public.copy_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = subscriber_id);
CREATE POLICY "Admins manage copy subs" ON public.copy_subscriptions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_copy_subscriptions_updated_at
  BEFORE UPDATE ON public.copy_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mentor applications
CREATE TABLE IF NOT EXISTS public.mentor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  trading_style TEXT,
  pairs TEXT,
  bio TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mentor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own application" ON public.mentor_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own application" ON public.mentor_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage applications" ON public.mentor_applications
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_mentor_applications_updated_at
  BEFORE UPDATE ON public.mentor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-grant moderator role on approval (auto-approve flow)
CREATE OR REPLACE FUNCTION public.handle_mentor_application_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'moderator'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mentor_application_approval
  AFTER INSERT OR UPDATE OF status ON public.mentor_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_mentor_application_approval();
