-- Trading Signals table
CREATE TABLE public.trading_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hit_tp', 'hit_sl', 'cancelled')),
  author_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view signals"
  ON public.trading_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and moderators can insert signals"
  ON public.trading_signals FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can update signals"
  ON public.trading_signals FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins can delete signals"
  ON public.trading_signals FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_trading_signals_updated_at
  BEFORE UPDATE ON public.trading_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  youtube_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'webinar',
  duration TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view videos"
  ON public.videos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert videos"
  ON public.videos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update videos"
  ON public.videos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete videos"
  ON public.videos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();