-- ============================================================
-- Migration: adventure_routes 表加 stage_uuid 列
--
-- 问题：每次教师端 publish 时 adventure_routes 做 DELETE + INSERT，
-- 导致主键 id 重新生成。而学生端冒险关卡的 ID 此前由
-- source_stage_id + 主键 id 前 8 位拼接而成，因此每次 publish
-- 后关卡 ID 都不同，学生已完成关卡的完成记录指向旧 ID，显示
-- "进度重置"。
--
-- 修复：新增 stage_uuid 列，直接持久化教师端生成的稳定 ID，
-- 学生端 load 时直接读取该列，不再从主键重新计算。
--
-- 前置依赖：migration_add_adventure_paths.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 Change：fix-adventure-stage-id-stability
-- ============================================================

ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS stage_uuid TEXT;

COMMENT ON COLUMN public.adventure_routes.stage_uuid IS '教师端生成的稳定冒险关卡 ID，如 adventure_route_xxx_1；由应用层写入，跨 publish 保持不变';
