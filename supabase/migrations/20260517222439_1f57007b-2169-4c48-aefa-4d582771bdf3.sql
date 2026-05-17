-- Tighten RLS on analytics_events: restrict INSERT to explicit roles
-- (anon + authenticated) instead of the broad `public` role, and ensure
-- only admins can read. UPDATE/DELETE remain disallowed (no policies).

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Admins view all analytics events" ON public.analytics_events;

-- Explicit, scoped insert policy (no longer `public`)
CREATE POLICY "analytics_events_insert_visitors"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Authenticated rows must belong to the inserter; anonymous rows must be null.
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
);

-- Read access strictly limited to admins
CREATE POLICY "analytics_events_select_admins"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
