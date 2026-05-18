CREATE TABLE public.user_favorite_instruments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

ALTER TABLE public.user_favorite_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites"
  ON public.user_favorite_instruments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own favorites"
  ON public.user_favorite_instruments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own favorites"
  ON public.user_favorite_instruments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own favorites"
  ON public.user_favorite_instruments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_favorite_instruments_user ON public.user_favorite_instruments (user_id, sort_order);