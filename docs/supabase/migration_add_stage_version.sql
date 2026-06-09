-- ============================================================
-- Migration: adventure_routes 和 adventure_stage_completions 加版本号
--
-- 目的：教师重新推送关卡后，如果内容变了，学生端能看到"已更新"标识。
-- content_hash 记录每个关卡的"答题内容指纹"，用于自动检测变化；
-- stage_version 在内容变化时自动递增，学生完成时记录当时的版本。
--
-- 前置依赖：migration_add_adventure_paths.sql 已执行
--           migration_add_adventure_progress.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：fix-adventure-stage-id-stability
-- ============================================================

-- 1. adventure_routes 加 content_hash TEXT
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMENT ON COLUMN public.adventure_routes.content_hash
    IS '答题内容指纹（sourceStageId + questionCount + passCriteria + 显示时长）；
        save() 时计算，用于自动检测内容是否变化；仅内部比较用，不含展示字段';

-- 2. adventure_routes 加 stage_version INTEGER
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS stage_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.adventure_routes.stage_version
    IS '关卡版本号；内容变化时自动 +1，学生完成时记录此版本以识别"已更新"';

-- 3. adventure_stage_completions 加 stage_version INTEGER
ALTER TABLE public.adventure_stage_completions
    ADD COLUMN IF NOT EXISTS stage_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.adventure_stage_completions.stage_version
    IS '学生完成时的关卡版本号；与 adventure_routes.stage_version 比较，
        若当前版本 > 完成版本，说明内容更新了';
