-- Enable pending orders in admin_live_test_limits.
-- BlackArrowTradePanel gates the pending-order modal on this flag.
-- If a row already exists, flip the flag. If not, insert safe defaults.
UPDATE public.admin_live_test_limits
SET pending_orders_enabled = true,
    updated_at = now()
WHERE id = (
  SELECT id FROM public.admin_live_test_limits ORDER BY created_at LIMIT 1
);

INSERT INTO public.admin_live_test_limits
  (max_order_volume, pending_orders_enabled, max_simultaneous_test_positions,
   max_daily_live_test_orders, max_daily_test_loss_usd, partial_close_cap_increase_enabled)
SELECT 0.01, true, 1, 5, 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.admin_live_test_limits);
