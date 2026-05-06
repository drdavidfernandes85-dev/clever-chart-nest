-- Make handle_new_user resilient: never block auth.signUp if profile insert fails.
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
    WHEN meta_lang ILIKE 'en-%' THEN 'en'
    WHEN meta_lang ILIKE 'pt-%' THEN 'pt-BR'
    WHEN meta_lang ILIKE 'es-%' THEN 'es'
    ELSE 'es'
  END;

  BEGIN
    INSERT INTO public.profiles (user_id, display_name, preferred_language)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      resolved_lang
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Ensure profiles.user_id has a unique constraint so ON CONFLICT works
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table OR unique_violation THEN NULL;
    END;
  END IF;
END $$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();