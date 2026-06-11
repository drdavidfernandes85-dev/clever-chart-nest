DROP POLICY IF EXISTS "Users insert own signup" ON public.user_signups;
CREATE POLICY "Users insert own signup" ON public.user_signups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND lower(email) = lower(auth.email()));