-- Webinars feature
CREATE TABLE public.webinars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT,
  host_name TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  stream_url TEXT,
  recording_url TEXT,
  thumbnail_url TEXT,
  category TEXT NOT NULL DEFAULT 'live',
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | ended | canceled
  performance_impact TEXT,
  reminder_15m_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_live_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webinars_scheduled_at ON public.webinars(scheduled_at DESC);
CREATE INDEX idx_webinars_status ON public.webinars(status);

ALTER TABLE public.webinars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Webinars viewable by authenticated"
ON public.webinars FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage webinars"
ON public.webinars FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_webinars_updated_at
BEFORE UPDATE ON public.webinars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-user reminder opt-in for webinars
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS webinar_email_reminders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS webinar_inapp_reminders BOOLEAN NOT NULL DEFAULT true;

-- Enable realtime so LIVE state propagates without refresh
ALTER TABLE public.webinars REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.webinars;

-- Trigger to fan out in-app notifications when a webinar goes live
CREATE OR REPLACE FUNCTION public.notify_webinar_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'live' AND COALESCE(OLD.status, '') <> 'live' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, ref_id)
    SELECT
      us.user_id,
      'webinar_live',
      '🔴 LIVE NOW: ' || NEW.title,
      COALESCE(NEW.host_name, 'Mentor') || ' is live — join the room',
      '/webinars/' || NEW.id::text,
      NEW.id
    FROM public.user_settings us
    WHERE us.webinar_inapp_reminders = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER webinar_live_notify
AFTER UPDATE ON public.webinars
FOR EACH ROW EXECUTE FUNCTION public.notify_webinar_live();