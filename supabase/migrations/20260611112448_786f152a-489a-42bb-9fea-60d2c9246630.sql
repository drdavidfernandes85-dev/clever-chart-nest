-- Fix missing grants on user_favorite_instruments
-- The table already has RLS policies and is used by the useFavorites hook.
-- Without these grants the Data API returns permission errors.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_instruments TO authenticated;
GRANT ALL ON public.user_favorite_instruments TO service_role;