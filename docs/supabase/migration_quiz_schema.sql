-- ============================================================
-- Migration: slices → quizzes, stage_slices → stage_quizzes
-- 前置依赖：auth.sql + sightreading.sql 已执行
-- 幂等：可重复运行
-- ============================================================

-- 1. 重命名表
ALTER TABLE IF EXISTS public.slices       RENAME TO quizzes;
ALTER TABLE IF EXISTS public.stage_slices RENAME TO stage_quizzes;

-- 2. quizzes：删旧列，加新列
ALTER TABLE public.quizzes
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS pitch,
    DROP COLUMN IF EXISTS placement;

ALTER TABLE public.quizzes
    ADD COLUMN IF NOT EXISTS module TEXT
        CHECK (module IN ('notes', 'symbols', 'theory', 'patterns')),
    ADD COLUMN IF NOT EXISTS last_updated_by UUID;

-- 补全 NOT NULL（已有行 module 为 NULL，需先填充再加约束）
-- 如果表是全新的可直接加 NOT NULL；迁移时先 UPDATE 再加约束
UPDATE public.quizzes SET module = 'notes'   WHERE module IS NULL AND id LIKE 'A_%';
UPDATE public.quizzes SET module = 'symbols' WHERE module IS NULL AND id LIKE 'B_%';
UPDATE public.quizzes SET module = 'theory'  WHERE module IS NULL AND id LIKE 'C_%';
UPDATE public.quizzes SET module = 'patterns'WHERE module IS NULL AND id LIKE 'D_%';
-- 兜底：仍为 NULL 的设为 notes
UPDATE public.quizzes SET module = 'notes'   WHERE module IS NULL;

ALTER TABLE public.quizzes
    ALTER COLUMN module SET NOT NULL;

-- 3. stage_quizzes：重命名 slice_id → quiz_id，加 last_updated_by
ALTER TABLE public.stage_quizzes
    RENAME COLUMN slice_id TO quiz_id;

ALTER TABLE public.stage_quizzes
    ADD COLUMN IF NOT EXISTS last_updated_by UUID;

-- 4. stages：加 last_updated_by
ALTER TABLE public.stages
    ADD COLUMN IF NOT EXISTS last_updated_by UUID;

-- 5. 重建索引（旧索引名已失效，先删再建）
DROP INDEX IF EXISTS idx_slices_type_difficulty;
DROP INDEX IF EXISTS idx_slices_pitch_placement;
DROP INDEX IF EXISTS idx_stage_slices_slice;
DROP INDEX IF EXISTS idx_stage_slices_stage_position;

CREATE INDEX IF NOT EXISTS idx_quizzes_module_difficulty
    ON public.quizzes (module, difficulty)
    WHERE del_status = false;

CREATE INDEX IF NOT EXISTS idx_stage_quizzes_quiz
    ON public.stage_quizzes (quiz_id)
    WHERE del_status = false;

CREATE INDEX IF NOT EXISTS idx_stage_quizzes_stage_position
    ON public.stage_quizzes (stage_id, position)
    WHERE del_status = false;

-- 6. 重建 updated_at 触发器（表名变了）
DROP TRIGGER IF EXISTS slices_set_updated_at ON public.quizzes;
DROP TRIGGER IF EXISTS quizzes_set_updated_at ON public.quizzes;
CREATE TRIGGER quizzes_set_updated_at
    BEFORE UPDATE ON public.quizzes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 7. 重建级联软删触发器
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_stage_quizzes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'quizzes' THEN
        UPDATE public.stage_quizzes
        SET del_status = true
        WHERE quiz_id = NEW.id AND del_status = false;
    ELSIF TG_TABLE_NAME = 'stages' THEN
        UPDATE public.stage_quizzes
        SET del_status = true
        WHERE stage_id = NEW.id AND del_status = false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slice_soft_delete  ON public.quizzes;
DROP TRIGGER IF EXISTS trg_quiz_soft_delete   ON public.quizzes;
DROP TRIGGER IF EXISTS trg_stage_soft_delete  ON public.stages;
CREATE TRIGGER trg_quiz_soft_delete
    AFTER UPDATE OF del_status ON public.quizzes
    FOR EACH ROW
    WHEN (NEW.del_status = true AND OLD.del_status = false)
    EXECUTE FUNCTION public.cascade_soft_delete_stage_quizzes();

CREATE TRIGGER trg_stage_soft_delete
    AFTER UPDATE OF del_status ON public.stages
    FOR EACH ROW
    WHEN (NEW.del_status = true AND OLD.del_status = false)
    EXECUTE FUNCTION public.cascade_soft_delete_stage_quizzes();

-- 8. RLS：重建 quizzes / stage_quizzes 策略（旧策略名 slices_* 已随表重命名失效）
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slices_select_all"   ON public.quizzes;
DROP POLICY IF EXISTS "slices_admin_write"  ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_select_all"  ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_admin_write" ON public.quizzes;

CREATE POLICY "quizzes_select_all"
    ON public.quizzes FOR SELECT
    USING (true);

CREATE POLICY "quizzes_admin_write"
    ON public.quizzes FOR ALL
    TO authenticated
    USING      (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

ALTER TABLE public.stage_quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_slices_select_all"   ON public.stage_quizzes;
DROP POLICY IF EXISTS "stage_slices_admin_write"  ON public.stage_quizzes;
DROP POLICY IF EXISTS "stage_quizzes_select_all"  ON public.stage_quizzes;
DROP POLICY IF EXISTS "stage_quizzes_admin_write" ON public.stage_quizzes;

CREATE POLICY "stage_quizzes_select_all"
    ON public.stage_quizzes FOR SELECT
    USING (true);

CREATE POLICY "stage_quizzes_admin_write"
    ON public.stage_quizzes FOR ALL
    TO authenticated
    USING      (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');
