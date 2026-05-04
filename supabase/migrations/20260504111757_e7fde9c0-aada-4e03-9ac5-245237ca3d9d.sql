
-- Reorganize Community Hub channels: remove economics & trades_room; add language rooms.
DELETE FROM public.messages WHERE channel_id IN (
  'e7b359b8-a805-404a-8b8b-5316204fbf4a',
  'be5738db-7be1-4fad-af80-f93a6c454e99'
);
DELETE FROM public.channels WHERE id IN (
  'e7b359b8-a805-404a-8b8b-5316204fbf4a',
  'be5738db-7be1-4fad-af80-f93a6c454e99'
);

INSERT INTO public.channels (name, category)
SELECT 'espanol', 'Trading'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'espanol');

INSERT INTO public.channels (name, category)
SELECT 'portugues_brasil', 'Trading'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'portugues_brasil');
