
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
ON public.site_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.site_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime so all users see changes instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
