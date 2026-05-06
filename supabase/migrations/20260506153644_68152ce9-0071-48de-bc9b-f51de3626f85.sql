CREATE TABLE public.user_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'es',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own signup"
ON public.user_signups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own signup"
ON public.user_signups
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all signups"
ON public.user_signups
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_signups_user_id ON public.user_signups(user_id);