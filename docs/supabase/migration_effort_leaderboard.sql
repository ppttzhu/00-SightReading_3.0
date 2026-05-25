-- ============================================================
-- Migration: 努力榜 RPC 函数
-- 前置依赖：migration_stats_schema.sql 已执行
-- 幂等：可重复运行（CREATE OR REPLACE）
-- ============================================================

-- 努力榜排行：查询指定时间范围内所有用户的做题总数
-- 使用 SECURITY DEFINER 绕过 practice_records 的 RLS 策略
-- 仅返回 user_id、nickname、total_count，不暴露详细答题记录
CREATE OR REPLACE FUNCTION public.get_effort_leaderboard(
  week_start TIMESTAMPTZ,
  week_end TIMESTAMPTZ
)
RETURNS TABLE (
  user_id UUID,
  nickname TEXT,
  total_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.user_id, p.nickname, COUNT(*) as total_count
  FROM practice_records pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE pr.created_at >= week_start
    AND pr.created_at < week_end
  GROUP BY pr.user_id, p.nickname
  ORDER BY total_count DESC;
$$;
