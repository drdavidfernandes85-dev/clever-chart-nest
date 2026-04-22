-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('signal','mention','webinar','calendar','reply')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  ref_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: fan-out new signals to all profiles
CREATE OR REPLACE FUNCTION public.notify_new_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link, ref_id)
  SELECT
    p.user_id,
    'signal',
    'New ' || UPPER(NEW.direction) || ' signal: ' || NEW.pair,
    'Entry ' || NEW.entry_price ||
      COALESCE(' • SL ' || NEW.stop_loss, '') ||
      COALESCE(' • TP ' || NEW.take_profit, ''),
    '/signals',
    NEW.id
  FROM public.profiles p
  WHERE p.user_id <> NEW.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_signal ON public.trading_signals;
CREATE TRIGGER trg_notify_new_signal
AFTER INSERT ON public.trading_signals
FOR EACH ROW EXECUTE FUNCTION public.notify_new_signal();

-- Trigger: chat mentions (@displayname) and replies
CREATE OR REPLACE FUNCTION public.notify_chat_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  reply_target_user UUID;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE user_id = NEW.user_id;

  -- Mentions: any profile whose display_name appears as @name in content
  INSERT INTO public.notifications (user_id, kind, title, body, link, ref_id)
  SELECT
    p.user_id,
    'mention',
    COALESCE(sender_name, 'Someone') || ' mentioned you',
    LEFT(NEW.content, 140),
    '/chatroom',
    NEW.id
  FROM public.profiles p
  WHERE p.user_id <> NEW.user_id
    AND NEW.content ILIKE '%@' || p.display_name || '%';

  -- Replies
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT user_id INTO reply_target_user FROM public.messages WHERE id = NEW.reply_to_id;
    IF reply_target_user IS NOT NULL AND reply_target_user <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link, ref_id)
      VALUES (
        reply_target_user,
        'reply',
        COALESCE(sender_name, 'Someone') || ' replied to your message',
        LEFT(NEW.content, 140),
        '/chatroom',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_event ON public.messages;
CREATE TRIGGER trg_notify_chat_event
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_event();