-- ============================================================
-- Migration: stages 表添加 question_count 列
-- 前置依赖：migration_quiz_schema.sql 已执行
-- 幂等：可重复运行
-- ============================================================

ALTER TABLE public.stages
    ADD COLUMN IF NOT EXISTS question_count INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.stages.question_count IS '关卡题目数量（客户端用有放回抽样实现）';
