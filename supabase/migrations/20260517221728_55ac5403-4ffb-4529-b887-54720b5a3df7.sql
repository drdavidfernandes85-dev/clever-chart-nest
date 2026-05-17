-- Analytics events store for internal dashboard
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event TEXT NOT NULL,
  section TEXT,
  path TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_event ON public.analytics_events (event);
CREATE INDEX idx_analytics_events_section ON public.analytics_events (section);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) may insert events; this is a write-only firehose
CREATE POLICY "Anyone can insert analytics events"
  ON public.analytics_events
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read aggregated analytics
CREATE POLICY "Admins view all analytics events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
