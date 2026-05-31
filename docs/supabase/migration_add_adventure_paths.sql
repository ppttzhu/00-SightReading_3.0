-- ============================================================
-- Migration: 创建 adventure_routes 表（冒险路线关卡数据）
-- 前置依赖：sightreading.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：add-adventure-learning-path
-- ============================================================

CREATE TABLE IF NOT EXISTS public.adventure_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name TEXT NOT NULL DEFAULT 'main',
    stage_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_stage_id TEXT,
    source_module TEXT,
    question_count INTEGER NOT NULL DEFAULT 5,
    unlock_rule TEXT NOT NULL DEFAULT 'previous_clear',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(route_name, stage_order)
);

CREATE INDEX IF NOT EXISTS idx_adventure_routes_route_name
    ON public.adventure_routes(route_name);

CREATE INDEX IF NOT EXISTS idx_adventure_routes_source_stage
    ON public.adventure_routes(source_stage_id);

COMMENT ON TABLE public.adventure_routes IS '冒险路线关卡数据；每行代表一个关卡，按 route_name + stage_order 排序';
COMMENT ON COLUMN public.adventure_routes.route_name IS '路线名称，预留多路线扩展；MVP 固定为 main';
COMMENT ON COLUMN public.adventure_routes.stage_order IS '排序序号，同一 route_name 内按此升序';
COMMENT ON COLUMN public.adventure_routes.source_stage_id IS '引用 customStages.id（软引用）';
COMMENT ON COLUMN public.adventure_routes.source_module IS '来源模块：notes/theory/symbols/patterns';
COMMENT ON COLUMN public.adventure_routes.question_count IS '出题数；超过题目数量时循环补题';
COMMENT ON COLUMN public.adventure_routes.unlock_rule IS '解锁规则；当前统一 previous_clear';
COMMENT ON COLUMN public.adventure_routes.source IS '来源标记：manual 手动 / assistant AI 草稿';
