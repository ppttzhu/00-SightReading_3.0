-- ============================================================
-- Migration: 创建 adventure_stage_completions 表（学生冒险闯关记录）
-- 前置依赖：sightreading.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：add-adventure-learning-path
-- ============================================================

CREATE TABLE IF NOT EXISTS public.adventure_stage_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    stage_id TEXT NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    time_spent_sec INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_adventure_completions_user
    ON public.adventure_stage_completions(user_id);

COMMENT ON TABLE public.adventure_stage_completions IS '学生冒险闯关记录；每人每关一条，存储完成状态、得分和时间';
COMMENT ON COLUMN public.adventure_stage_completions.stage_id IS '冒险关卡 ID（adventure_route_xxx）';
COMMENT ON COLUMN public.adventure_stage_completions.score IS '正确率 0-100';

-- RLS：学生只能读写自己的行
ALTER TABLE public.adventure_stage_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_completions_select_own" ON public.adventure_stage_completions;
DROP POLICY IF EXISTS "adventure_completions_insert_own" ON public.adventure_stage_completions;
DROP POLICY IF EXISTS "adventure_completions_update_own" ON public.adventure_stage_completions;

CREATE POLICY "adventure_completions_select_own"
    ON public.adventure_stage_completions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "adventure_completions_insert_own"
    ON public.adventure_stage_completions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "adventure_completions_update_own"
    ON public.adventure_stage_completions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
