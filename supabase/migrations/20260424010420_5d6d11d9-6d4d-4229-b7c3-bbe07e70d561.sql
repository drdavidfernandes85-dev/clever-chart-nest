DROP POLICY IF EXISTS "Admins manage webinars" ON public.webinars;

CREATE POLICY "Admins insert webinars"
ON public.webinars FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update webinars"
ON public.webinars FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete webinars"
ON public.webinars FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));