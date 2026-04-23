INSERT INTO public.channels (name, category, description)
SELECT 'general', 'Trading', 'General community chat — say hi, share wins, ask questions'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'general');