-- ============================================================
-- Migration: 创建 adventure_paths 表（冒险路线编排数据）
-- 前置依赖：sightreading.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：add-adventure-learning-path
-- ============================================================

CREATE TABLE IF NOT EXISTS public.adventure_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.adventure_paths IS '存储冒险路线的编排数据；stages 列包含完整的 AdventureStage[] 数组 JSONB';

-- 插入默认行（确保应用层 upsert 可命中固定 ID）
INSERT INTO public.adventure_paths (id, stages, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '[]',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;
