-- ============================================================
-- 清空所有非用户数据表（保留 profiles / auth.users）
-- 用于：开发环境重置、测试数据清理、迁移前归零
-- ============================================================

-- TRUNCATE 自动重置自增列（BIGSERIAL id 从 1 开始）
-- CASCADE 级联处理外键约束（stage_quizzes → stages/quizzes）
-- RESTART IDENTITY 重置序列计数器

TRUNCATE TABLE public.test_success_records      RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.practice_records          RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.user_slice_stats          RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.stage_quizzes             RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.student_progress          RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.quizzes                   RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.stages                    RESTART IDENTITY CASCADE;

-- 如需软删表（通过 del_status 标记）也一并清：
-- 但如果只需要清除活跃行（del_status=false），上面的 TRUNCATE 已经够用了
-- 因为 TRUNCATE 是全表硬删，不触发触发器，不经过 RLS

-- 保留的表（不做任何操作）：
--   public.profiles          ← 用户基本信息
--   auth.users               ← Supabase 认证用户（由 Supabase 管理）
