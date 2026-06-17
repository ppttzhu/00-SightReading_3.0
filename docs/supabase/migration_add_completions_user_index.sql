-- ============================================================
-- Migration: adventure_stage_completions 加 user_id 索引
--
-- 目的：加速学生端加载闯关地图时按 user_id 筛选完成记录的查询。
--       adventure_stage_completions 的 PK 是 (user_id, stage_id)，
--       Postgres 默认会为 PK 创建复合索引，但单独按 user_id 查询时
--       可能需要扫描全部行。确保 user_id 上有索引可提升性能。
--
-- 前置依赖：migration_add_adventure_progress.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：（首批加载优化）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_adventure_completions_user
    ON public.adventure_stage_completions(user_id);

COMMENT ON INDEX public.idx_adventure_completions_user
    IS '加速按用户筛选完成记录的查询（闯关地图加载、进度同步）';
