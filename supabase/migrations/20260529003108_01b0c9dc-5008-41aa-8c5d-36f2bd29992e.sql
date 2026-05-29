CREATE TABLE IF NOT EXISTS public.canary_activation_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  previous_state text,
  new_state text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_user_id uuid,
  changed_by_display text,
  policy_version text NOT NULL,
  scope_snapshot jsonb NOT NULL,
  acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_test_result jsonb,
  route_audit_status text,
  broker_symbol_audit_status text,
  live_exposure_snapshot jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.canary_activation_audit TO authenticated;
GRANT ALL ON public.canary_activation_audit TO service_role;

ALTER TABLE public.canary_activation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view canary activation audit"
  ON public.canary_activation_audit FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert canary activation audit"
  ON public.canary_activation_audit FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (changed_by_user_id = auth.uid()));