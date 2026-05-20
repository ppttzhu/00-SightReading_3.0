-- ============================================================
-- Migration: 统计体系重构
-- 前置依赖：migration_quiz_schema.sql 已执行
-- 幂等：可重复运行
-- ============================================================

-- 1. 删除旧的 user_type_stats 表和触发器
DROP TRIGGER IF EXISTS trg_practice_update_stats ON public.practice_records;
DROP FUNCTION IF EXISTS public.update_user_type_stats();
DROP TABLE IF EXISTS public.user_type_stats;

-- 2. 建 user_slice_stats 表（按 quiz_id 粒度）
CREATE TABLE IF NOT EXISTS public.user_slice_stats (
    user_id           UUID NOT NULL,
    quiz_id           TEXT NOT NULL,
    total_count       INT NOT NULL DEFAULT 0,
    correct_count     INT NOT NULL DEFAULT 0,
    wrong_count       INT NOT NULL DEFAULT 0,
    last_practiced_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, quiz_id)
);

COMMENT ON TABLE public.user_slice_stats IS '学生每道题的答题统计（永久保留，由触发器维护）';

-- 3. 改造 practice_records：删冗余列，slice_id→quiz_id
ALTER TABLE public.practice_records
    DROP COLUMN IF EXISTS slice_type,
    DROP COLUMN IF EXISTS score,
    DROP COLUMN IF EXISTS del_status;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'practice_records' AND column_name = 'slice_id'
    ) THEN
        ALTER TABLE public.practice_records RENAME COLUMN slice_id TO quiz_id;
    END IF;
END $$;

-- 4. 改造 student_progress：删 id/del_status，改 PK
-- 先删旧约束，再重建
ALTER TABLE public.student_progress DROP CONSTRAINT IF EXISTS student_progress_pkey;
ALTER TABLE public.student_progress DROP COLUMN IF EXISTS id;
ALTER TABLE public.student_progress DROP COLUMN IF EXISTS del_status;

-- 重建复合 PK（如果还没有）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.student_progress'::regclass AND contype = 'p'
    ) THEN
        ALTER TABLE public.student_progress ADD PRIMARY KEY (user_id, module);
    END IF;
END $$;

-- 5. 建 test_success_records 表（闯关排行榜）
CREATE TABLE IF NOT EXISTS public.test_success_records (
    user_id         UUID NOT NULL,
    stage_id        TEXT NOT NULL,
    correct_count   INT NOT NULL,
    wrong_count     INT NOT NULL,
    time_spent_sec  INT NOT NULL,
    score           INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, stage_id)
);

COMMENT ON TABLE public.test_success_records IS '闯关成功记录（排行榜，每人每关保留最新一次）';

-- 6. 重建触发器：practice_records INSERT → 更新 user_slice_stats
CREATE OR REPLACE FUNCTION public.update_user_slice_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_slice_stats (
        user_id, quiz_id, total_count, correct_count, wrong_count, last_practiced_at
    ) VALUES (
        NEW.user_id,
        NEW.quiz_id,
        1,
        CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
        NEW.created_at
    )
    ON CONFLICT (user_id, quiz_id)
    DO UPDATE SET
        total_count       = public.user_slice_stats.total_count   + 1,
        correct_count     = public.user_slice_stats.correct_count + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
        wrong_count       = public.user_slice_stats.wrong_count   + CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
        last_practiced_at = NEW.created_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_practice_update_slice_stats ON public.practice_records;
CREATE TRIGGER trg_practice_update_slice_stats
    AFTER INSERT ON public.practice_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_slice_stats();

-- 7. 更新 TTL 清理函数（去掉 del_status 过滤）
CREATE OR REPLACE FUNCTION public.clean_old_practice_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.practice_records
    WHERE created_at < now() - interval '30 days';
END;
$$;

-- 8. RLS for user_slice_stats
ALTER TABLE public.user_slice_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_slice_stats_self"       ON public.user_slice_stats;
DROP POLICY IF EXISTS "user_slice_stats_admin_read" ON public.user_slice_stats;

CREATE POLICY "user_slice_stats_self"
    ON public.user_slice_stats FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "user_slice_stats_admin_read"
    ON public.user_slice_stats FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'admin');

-- 9. RLS for test_success_records
ALTER TABLE public.test_success_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_success_self"       ON public.test_success_records;
DROP POLICY IF EXISTS "test_success_admin_read" ON public.test_success_records;

CREATE POLICY "test_success_self"
    ON public.test_success_records FOR ALL
    TO authenticated
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "test_success_admin_read"
    ON public.test_success_records FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'admin');

-- 10. 重建 practice_records 索引（旧索引引用了已删列）
DROP INDEX IF EXISTS idx_practice_records_mistakes;
DROP INDEX IF EXISTS idx_practice_records_user_time;

CREATE INDEX IF NOT EXISTS idx_practice_records_mistakes
    ON public.practice_records (user_id, module, created_at DESC)
    WHERE is_correct = false;

CREATE INDEX IF NOT EXISTS idx_practice_records_user_time
    ON public.practice_records (user_id, created_at DESC);
