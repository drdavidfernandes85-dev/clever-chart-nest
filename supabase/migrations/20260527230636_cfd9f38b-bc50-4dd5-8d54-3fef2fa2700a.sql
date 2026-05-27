
CREATE TABLE public.lifecycle_validation_authorisations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  authorisation_type text NOT NULL DEFAULT 'final_controlled_open_close_lifecycle_validation',
  status text NOT NULL DEFAULT 'pending_preview',
  authorised_by uuid NOT NULL,
  authorised_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  mt5_login text NOT NULL,
  mt5_server text NOT NULL,
  route_account_id text NOT NULL,
  display_symbol text NOT NULL,
  broker_symbol text NOT NULL,

  entry_side text NOT NULL,
  entry_volume numeric NOT NULL,
  entry_order_type text NOT NULL DEFAULT 'market',
  entry_outbound_dto jsonb NOT NULL,

  maximum_entry_dispatches integer NOT NULL DEFAULT 1,
  maximum_close_dispatches integer NOT NULL DEFAULT 1,
  entry_dispatches_consumed integer NOT NULL DEFAULT 0,
  close_dispatches_consumed integer NOT NULL DEFAULT 0,

  entry_consumed_at timestamptz,
  entry_order_id text,
  entry_retcode integer,
  entry_request_id text,
  entry_evidence jsonb,

  confirmed_position_ticket text,
  confirmed_position_at timestamptz,
  confirmed_position_evidence jsonb,

  close_consumed_at timestamptz,
  close_order_id text,
  close_deal_id text,
  close_retcode integer,
  close_evidence jsonb,

  controlled_close_confirmed boolean NOT NULL DEFAULT false,
  lifecycle_passed boolean NOT NULL DEFAULT false,
  classification text,

  acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_snapshot jsonb,
  failure_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lifecycle_validation_authorisations TO authenticated;
GRANT ALL ON public.lifecycle_validation_authorisations TO service_role;

ALTER TABLE public.lifecycle_validation_authorisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view lifecycle auths"
ON public.lifecycle_validation_authorisations
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert lifecycle auths"
ON public.lifecycle_validation_authorisations
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND authorised_by = auth.uid());

CREATE POLICY "Admins update lifecycle auths"
ON public.lifecycle_validation_authorisations
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_lifecycle_validation_authorisations_updated_at
BEFORE UPDATE ON public.lifecycle_validation_authorisations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lifecycle_validation_auth_status ON public.lifecycle_validation_authorisations(status);
CREATE INDEX idx_lifecycle_validation_auth_authorised_by ON public.lifecycle_validation_authorisations(authorised_by);
