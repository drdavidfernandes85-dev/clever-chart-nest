-- 1) Add preferred_language to newsletter_subscribers
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'es';

-- Helpful index for email-automation segmentation
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_lang
  ON public.newsletter_subscribers (preferred_language);

-- Avoid duplicate email rows when leads register multiple times
CREATE UNIQUE INDEX IF NOT EXISTS uniq_newsletter_subscribers_email_lower
  ON public.newsletter_subscribers ((lower(email)));

-- 2) Update handle_new_user to capture preferred_language from sign-up metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_lang text;
  resolved_lang text;
BEGIN
  meta_lang := NEW.raw_user_meta_data->>'preferred_language';
  resolved_lang := CASE
    WHEN meta_lang IN ('en','es','pt-BR') THEN meta_lang
    WHEN meta_lang = 'pt' THEN 'pt-BR'
    ELSE 'es'
  END;

  INSERT INTO public.profiles (user_id, display_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    resolved_lang
  );
  RETURN NEW;
END;
$function$;