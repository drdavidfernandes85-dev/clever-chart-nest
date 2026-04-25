-- Per-user dashboard layout storage
CREATE TABLE public.user_dashboard_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  preset TEXT NOT NULL DEFAULT 'classic',
  layouts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dashboard layout"
  ON public.user_dashboard_layouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dashboard layout"
  ON public.user_dashboard_layouts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dashboard layout"
  ON public.user_dashboard_layouts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own dashboard layout"
  ON public.user_dashboard_layouts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_dashboard_layouts_updated_at
  BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
