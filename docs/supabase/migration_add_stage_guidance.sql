-- ============================================================
-- Migration: 在 stages 表上加 guidance 列（学习指导 Markdown 文本）
-- 前置依赖：sightreading.sql + migration_quiz_schema.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 PR：feat(stages): 闯关模式增加学习指导 (#14 v2)
-- ============================================================

ALTER TABLE public.stages
    ADD COLUMN IF NOT EXISTS guidance TEXT;

COMMENT ON COLUMN public.stages.guidance IS '老师为该关卡撰写的「学习指导」Markdown 文本；NULL 或空字符串视为无指导';
