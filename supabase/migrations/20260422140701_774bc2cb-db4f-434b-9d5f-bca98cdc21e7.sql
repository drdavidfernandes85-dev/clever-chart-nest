-- Add opt-out preference for leaderboard
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT false;

-- Create leaderboard view aggregating from trade_journal
CREATE OR REPLACE VIEW public.leaderboard_stats
WITH (security_invoker = true)
AS
SELECT
  p.user_id,
  p.display_name,
  p.avatar_url,
  COUNT(t.id) FILTER (WHERE t.status = 'closed' AND t.pnl IS NOT NULL) AS total_trades,
  COALESCE(SUM(t.pnl) FILTER (WHERE t.status = 'closed' AND t.pnl IS NOT NULL), 0) AS total_pnl,
  COALESCE(SUM(t.pnl) FILTER (WHERE t.status = 'closed' AND t.pnl IS NOT NULL AND t.closed_at >= now() - interval '7 days'), 0) AS pnl_7d,
  COALESCE(SUM(t.pnl) FILTER (WHERE t.status = 'closed' AND t.pnl IS NOT NULL AND t.closed_at >= now() - interval '30 days'), 0) AS pnl_30d,
  COALESCE(
    ROUND(
      100.0 * COUNT(t.id) FILTER (WHERE t.status = 'closed' AND t.pnl > 0)::numeric
      / NULLIF(COUNT(t.id) FILTER (WHERE t.status = 'closed' AND t.pnl IS NOT NULL), 0),
      1
    ), 0
  ) AS win_rate,
  COALESCE(MAX(t.pnl) FILTER (WHERE t.status = 'closed'), 0) AS best_trade,
  COALESCE(AVG(t.r_multiple) FILTER (WHERE t.status = 'closed' AND t.r_multiple IS NOT NULL), 0) AS avg_r
FROM public.profiles p
LEFT JOIN public.trade_journal t ON t.user_id = p.user_id
WHERE p.leaderboard_opt_out = false
GROUP BY p.user_id, p.display_name, p.avatar_url;

GRANT SELECT ON public.leaderboard_stats TO authenticated;