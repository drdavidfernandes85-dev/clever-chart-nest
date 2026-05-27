CREATE TABLE public.controlled_retest_authorisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorised_by uuid NOT NULL,
  authorised_at timestamptz NOT NULL DEFAULT now(),
  permitted_symbol text NOT NULL,
  permitted_broker_symbol text NOT NULL,
  permitted_side text NOT NULL,
  permitted_volume numeric NOT NULL,
  permitted_route_account_id text NOT NULL,
  permitted_orders int NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_order_id text,
  outcome text,
  outcome_retcode int,
  outcome_payload jsonb,
  outbound_dto jsonb,
  position_confirmed_at timestamptz,
  close_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.controlled_retest_authorisations TO authenticated;
GRANT ALL ON public.controlled_retest_authorisations TO service_role;

ALTER TABLE public.controlled_retest_authorisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view controlled retest auths"
  ON public.controlled_retest_authorisations FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert controlled retest auths"
  ON public.controlled_retest_authorisations FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND authorised_by = auth.uid());

CREATE POLICY "Admins update controlled retest auths"
  ON public.controlled_retest_authorisations FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_controlled_retest_authorisations_updated_at
  BEFORE UPDATE ON public.controlled_retest_authorisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_controlled_retest_auth_unconsumed
  ON public.controlled_retest_authorisations (expires_at)
  WHERE consumed_at IS NULL;