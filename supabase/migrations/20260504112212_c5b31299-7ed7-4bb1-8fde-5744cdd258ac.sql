
DELETE FROM public.messages WHERE channel_id = '917739af-74c8-46b7-b81b-2d8c2618bab7';
DELETE FROM public.channels WHERE id = '917739af-74c8-46b7-b81b-2d8c2618bab7';

INSERT INTO public.channels (name, category)
SELECT 'trades_room', 'Trading'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'trades_room');
