
-- Default new applications to pending
ALTER TABLE public.mentor_applications ALTER COLUMN status SET DEFAULT 'pending';

-- Drop existing trigger and recreate so it only fires when an admin updates status to 'approved'
DROP TRIGGER IF EXISTS mentor_application_approval ON public.mentor_applications;

CREATE OR REPLACE FUNCTION public.handle_mentor_application_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'moderator'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mentor_application_approval
  AFTER UPDATE OF status ON public.mentor_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_mentor_application_approval();

-- Allow admins to update applications (RLS for UPDATE)
DROP POLICY IF EXISTS "Admins update applications" ON public.mentor_applications;
CREATE POLICY "Admins update applications" ON public.mentor_applications
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
