-- ============================================================
-- Migration: adventure_routes 表增加音符显示/隐藏时间和通关标准
-- + adventure_stage_completions 表增加 passed 列
-- 前置依赖：migration_add_adventure_paths.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：add-stage-config-params
-- ============================================================

-- 1. adventure_routes 加 note_display_ms 列
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS note_display_ms INTEGER DEFAULT 3000;

COMMENT ON COLUMN public.adventure_routes.note_display_ms IS '音符显示时间（毫秒），默认 3000；只对闯关模式生效';

-- 2. adventure_routes 加 note_hidden_ms 列
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS note_hidden_ms INTEGER DEFAULT 6000;

COMMENT ON COLUMN public.adventure_routes.note_hidden_ms IS '音符隐藏时间（毫秒），默认 6000；只对闯关模式生效';

-- 3. adventure_routes 加 pass_enabled / pass_min_accuracy 列
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS pass_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS pass_min_accuracy INTEGER DEFAULT 80;

COMMENT ON COLUMN public.adventure_routes.pass_enabled IS '是否启用通关标准；false 时答完即过';
COMMENT ON COLUMN public.adventure_routes.pass_min_accuracy IS '最低正确率（1-100），仅 pass_enabled=true 时生效';

-- 4. adventure_stage_completions 加 passed 列
ALTER TABLE public.adventure_stage_completions
    ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.adventure_stage_completions.passed IS '本次是否通过（按通关标准判定）；默认 true 兼容旧数据';
