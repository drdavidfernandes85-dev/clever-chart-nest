CREATE TABLE public.trading_layer_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  event_id text,
  trader_id text,
  account_id text,
  signal_id text,
  ticket text,
  signature_provided boolean NOT NULL DEFAULT false,
  signature_valid boolean,
  processing_status text NOT NULL DEFAULT 'received',
  processing_error text,
  raw_payload jsonb NOT NULL,
  raw_headers jsonb,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE INDEX idx_tlwe_event_type ON public.trading_layer_webhook_events(event_type);
CREATE INDEX idx_tlwe_received_at ON public.trading_layer_webhook_events(received_at DESC);
CREATE INDEX idx_tlwe_trader_id ON public.trading_layer_webhook_events(trader_id);
CREATE INDEX idx_tlwe_signal_id ON public.trading_layer_webhook_events(signal_id);
CREATE INDEX idx_tlwe_ticket ON public.trading_layer_webhook_events(ticket);

ALTER TABLE public.trading_layer_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all webhook events"
ON public.trading_layer_webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
