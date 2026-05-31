-- ============================================================
-- Migration: 创建 adventure_progress 表（学生冒险闯关进度）
-- 前置依赖：sightreading.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：add-adventure-learning-path
-- ============================================================

CREATE TABLE IF NOT EXISTS public.adventure_progress (
    user_id UUID NOT NULL,
    completed_stage_ids TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

COMMENT ON TABLE public.adventure_progress IS '学生冒险闯关进度；每行代表一个学生已完成的关卡 ID 列表';
COMMENT ON COLUMN public.adventure_progress.completed_stage_ids IS '已完成的冒险关卡 ID 数组';

-- RLS：学生只能读写自己的行
ALTER TABLE public.adventure_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_progress_select_own" ON public.adventure_progress;
DROP POLICY IF EXISTS "adventure_progress_upsert_own" ON public.adventure_progress;

CREATE POLICY "adventure_progress_select_own"
    ON public.adventure_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "adventure_progress_upsert_own"
    ON public.adventure_progress FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "adventure_progress_update_own"
    ON public.adventure_progress FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
