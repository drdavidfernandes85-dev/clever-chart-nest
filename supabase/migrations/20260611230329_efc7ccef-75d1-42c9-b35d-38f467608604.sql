-- Item 4: region correction (new-york -> london, per MetaAPI source of truth)
UPDATE public.user_mt_accounts
   SET region = 'london',
       updated_at = now()
 WHERE login = '87943580'
   AND region IS DISTINCT FROM 'london';

-- Item 3: stop the metaapi_account_id column from lying.
-- Where the value equals trading_layer_trader_id, it is provably a TL id
-- (not a MetaAPI id). NULL it so Pass 2 can populate it with the real
-- MetaAPI _id once the account is deployed. trading_layer_trader_id is
-- left intact and remains the resolution source of truth.
UPDATE public.user_mt_accounts
   SET metaapi_account_id = NULL,
       updated_at = now()
 WHERE metaapi_account_id IS NOT NULL
   AND trading_layer_trader_id IS NOT NULL
   AND metaapi_account_id = trading_layer_trader_id;
