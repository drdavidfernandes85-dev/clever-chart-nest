UPDATE public.journal_deals
SET entry = CASE entry_raw
  WHEN 0 THEN 'in'
  WHEN 1 THEN 'out'
  WHEN 2 THEN 'inout'
  WHEN 3 THEN 'out_by'
  ELSE NULL
END
WHERE entry IS NULL AND entry_raw IS NOT NULL;