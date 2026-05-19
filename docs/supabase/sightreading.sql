-- ============================================================
-- SightReading Question Data Schema
-- 在 Supabase SQL Editor 中整体执行；脚本是幂等的，可重复运行。
--
-- 前置依赖：docs/supabase/auth.sql 已执行
--   - public.profiles(id, nickname, role, created_at, updated_at)
--   - public.app_role enum
--   - public.current_user_role()
-- ============================================================


-- ------------------------------------------------------------
-- 0. 扩展已有 profiles 表：补充 del_status
-- ------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS del_status BOOLEAN NOT NULL DEFAULT false;


-- ------------------------------------------------------------
-- 1. slices 表：题目素材池
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slices (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('A', 'B', 'C', 'D')),
    content     JSONB NOT NULL DEFAULT '{}'::jsonb,
    difficulty  INT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 10),
    pitch       TEXT,         -- 仅 A 类有效
    placement   TEXT,         -- 仅 A 类有效：treble | bass
    del_status  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.slices              IS '题目素材池（单音/符号/乐理/音型）';
COMMENT ON COLUMN public.slices.pitch        IS '仅 A 类单音题目有效';
COMMENT ON COLUMN public.slices.placement    IS '仅 A 类单音题目有效：treble | bass';

-- 索引：按类型 + 难度筛选（题库浏览、关卡生成都会用）
CREATE INDEX IF NOT EXISTS idx_slices_type_difficulty
    ON public.slices (type, difficulty)
    WHERE del_status = false;

-- 索引：A 类按 pitch + placement 过滤
CREATE INDEX IF NOT EXISTS idx_slices_pitch_placement
    ON public.slices (pitch, placement)
    WHERE type = 'A' AND del_status = false;


-- ------------------------------------------------------------
-- 2. stages 表：关卡（含 admin 自定义 + 自动生成 preset）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stages (
    id          TEXT PRIMARY KEY,
    module      TEXT NOT NULL CHECK (module IN ('notes', 'symbols', 'theory', 'patterns')),
    title       TEXT NOT NULL,
    is_preset   BOOLEAN NOT NULL DEFAULT false,
    sort_index  INT NOT NULL DEFAULT 0,
    del_status  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stages IS '关卡（自定义 + 自动生成 preset）';

-- 索引：按模块 + sort_index 拉取
CREATE INDEX IF NOT EXISTS idx_stages_module_sort
    ON public.stages (module, sort_index)
    WHERE del_status = false;


-- ------------------------------------------------------------
-- 3. stage_slices 关联表：关卡包含哪些题目
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stage_slices (
    stage_id    TEXT NOT NULL,
    slice_id    TEXT NOT NULL,
    position    INT NOT NULL DEFAULT 0,
    del_status  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stage_id, slice_id)
);

COMMENT ON TABLE public.stage_slices IS '关卡-题目关联（多对多）';

-- 反向索引：按 slice_id 查所属关卡（级联软删用）
CREATE INDEX IF NOT EXISTS idx_stage_slices_slice
    ON public.stage_slices (slice_id)
    WHERE del_status = false;

-- 正向索引：按 stage_id + position 排序取出
CREATE INDEX IF NOT EXISTS idx_stage_slices_stage_position
    ON public.stage_slices (stage_id, position)
    WHERE del_status = false;


-- ------------------------------------------------------------
-- 4. student_progress 表：学生每模块解锁进度
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_progress (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    module      TEXT NOT NULL CHECK (module IN ('notes', 'symbols', 'theory', 'patterns')),
    unlocked    INT NOT NULL DEFAULT 1 CHECK (unlocked >= 1),
    del_status  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, module)
);

COMMENT ON TABLE public.student_progress IS '学生每模块解锁进度（跨设备同步）';


-- ------------------------------------------------------------
-- 5. practice_records 表：每次答题记录（30 天保留）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_records (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    stage_id        TEXT,
    slice_id        TEXT,
    slice_type      TEXT NOT NULL CHECK (slice_type IN ('A', 'B', 'C', 'D')),
    module          TEXT NOT NULL CHECK (module IN ('notes', 'symbols', 'theory', 'patterns')),
    is_correct      BOOLEAN NOT NULL,
    answered_wrong  TEXT,
    time_spent_ms   INT,
    score           INT,
    del_status      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.practice_records IS '每次答题记录（30 天后由 cron 清理）';

-- 错题查询加速：is_correct = false 的部分索引
CREATE INDEX IF NOT EXISTS idx_practice_records_mistakes
    ON public.practice_records (user_id, slice_type, created_at DESC)
    WHERE is_correct = false AND del_status = false;

-- 用户最近答题历史
CREATE INDEX IF NOT EXISTS idx_practice_records_user_time
    ON public.practice_records (user_id, created_at DESC)
    WHERE del_status = false;


-- ------------------------------------------------------------
-- 6. user_type_stats 表：用户各类型答题统计（永久保留）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_type_stats (
    user_id            UUID NOT NULL,
    slice_type         TEXT NOT NULL CHECK (slice_type IN ('A', 'B', 'C', 'D')),
    total_count        INT NOT NULL DEFAULT 0,
    correct_count      INT NOT NULL DEFAULT 0,
    wrong_count        INT NOT NULL DEFAULT 0,
    last_practiced_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, slice_type)
);

COMMENT ON TABLE public.user_type_stats IS '用户各类型答题统计（由 practice_records INSERT 触发器维护）';


-- ============================================================
-- 通用工具：updated_at 自动更新触发器
-- （public.set_updated_at() 已由 auth.sql 创建）
-- ============================================================

DROP TRIGGER IF EXISTS slices_set_updated_at ON public.slices;
CREATE TRIGGER slices_set_updated_at
    BEFORE UPDATE ON public.slices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS stages_set_updated_at ON public.stages;
CREATE TRIGGER stages_set_updated_at
    BEFORE UPDATE ON public.stages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS student_progress_set_updated_at ON public.student_progress;
CREATE TRIGGER student_progress_set_updated_at
    BEFORE UPDATE ON public.student_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- RLS 策略
-- Supabase 默认 PostgreSQL 15，CREATE POLICY 不支持 IF NOT EXISTS
-- → 用 DROP POLICY IF EXISTS + CREATE POLICY 保证幂等
-- ============================================================

-- ---------- slices：所有人可读，仅 admin 可写 ----------
ALTER TABLE public.slices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slices_select_all"  ON public.slices;
DROP POLICY IF EXISTS "slices_admin_write" ON public.slices;

CREATE POLICY "slices_select_all"
    ON public.slices FOR SELECT
    USING (true);

CREATE POLICY "slices_admin_write"
    ON public.slices FOR ALL
    TO authenticated
    USING      (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');


-- ---------- stages：所有人可读，仅 admin 可写 ----------
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stages_select_all"  ON public.stages;
DROP POLICY IF EXISTS "stages_admin_write" ON public.stages;

CREATE POLICY "stages_select_all"
    ON public.stages FOR SELECT
    USING (true);

CREATE POLICY "stages_admin_write"
    ON public.stages FOR ALL
    TO authenticated
    USING      (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');


-- ---------- stage_slices：所有人可读，仅 admin 可写 ----------
ALTER TABLE public.stage_slices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_slices_select_all"  ON public.stage_slices;
DROP POLICY IF EXISTS "stage_slices_admin_write" ON public.stage_slices;

CREATE POLICY "stage_slices_select_all"
    ON public.stage_slices FOR SELECT
    USING (true);

CREATE POLICY "stage_slices_admin_write"
    ON public.stage_slices FOR ALL
    TO authenticated
    USING      (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');


-- ---------- student_progress：自己读写，admin 全表可读 ----------
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_progress_self"        ON public.student_progress;
DROP POLICY IF EXISTS "student_progress_admin_read"  ON public.student_progress;

CREATE POLICY "student_progress_self"
    ON public.student_progress FOR ALL
    TO authenticated
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_progress_admin_read"
    ON public.student_progress FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'admin');


-- ---------- practice_records：自己读写，admin 全表可读 ----------
ALTER TABLE public.practice_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_records_self"       ON public.practice_records;
DROP POLICY IF EXISTS "practice_records_admin_read" ON public.practice_records;

CREATE POLICY "practice_records_self"
    ON public.practice_records FOR ALL
    TO authenticated
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "practice_records_admin_read"
    ON public.practice_records FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'admin');


-- ---------- user_type_stats：自己读，仅触发器写（DEFINER 绕过 RLS）----------
ALTER TABLE public.user_type_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_type_stats_self"        ON public.user_type_stats;
DROP POLICY IF EXISTS "user_type_stats_admin_read"  ON public.user_type_stats;

CREATE POLICY "user_type_stats_self"
    ON public.user_type_stats FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "user_type_stats_admin_read"
    ON public.user_type_stats FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'admin');


-- ============================================================
-- 触发器：practice_records INSERT → 更新 user_type_stats
-- SECURITY DEFINER 绕过 user_type_stats 的 RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_type_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_type_stats (
        user_id, slice_type, total_count, correct_count, wrong_count, last_practiced_at
    ) VALUES (
        NEW.user_id,
        NEW.slice_type,
        1,
        CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
        NEW.created_at
    )
    ON CONFLICT (user_id, slice_type)
    DO UPDATE SET
        total_count       = public.user_type_stats.total_count   + 1,
        correct_count     = public.user_type_stats.correct_count + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
        wrong_count       = public.user_type_stats.wrong_count   + CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
        last_practiced_at = NEW.created_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_practice_update_stats ON public.practice_records;
CREATE TRIGGER trg_practice_update_stats
    AFTER INSERT ON public.practice_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_type_stats();


-- ============================================================
-- 触发器：级联软删（slice / stage → stage_slices）
-- ============================================================

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_stage_slices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'slices' THEN
        UPDATE public.stage_slices
        SET del_status = true
        WHERE slice_id = NEW.id AND del_status = false;
    ELSIF TG_TABLE_NAME = 'stages' THEN
        UPDATE public.stage_slices
        SET del_status = true
        WHERE stage_id = NEW.id AND del_status = false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slice_soft_delete ON public.slices;
CREATE TRIGGER trg_slice_soft_delete
    AFTER UPDATE OF del_status ON public.slices
    FOR EACH ROW
    WHEN (NEW.del_status = true AND OLD.del_status = false)
    EXECUTE FUNCTION public.cascade_soft_delete_stage_slices();

DROP TRIGGER IF EXISTS trg_stage_soft_delete ON public.stages;
CREATE TRIGGER trg_stage_soft_delete
    AFTER UPDATE OF del_status ON public.stages
    FOR EACH ROW
    WHEN (NEW.del_status = true AND OLD.del_status = false)
    EXECUTE FUNCTION public.cascade_soft_delete_stage_slices();


-- ============================================================
-- 定时清理：删除 30 天前的 practice_records
-- ============================================================

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

-- 启用 pg_cron 后取消注释执行一次：
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule(
--       'clean-practice-records',
--       '0 3 * * *',
--       $$SELECT public.clean_old_practice_records()$$
--   );


-- ============================================================
-- 可选：active_* 视图，应用层若希望自动过滤软删可启用
-- ============================================================

-- CREATE OR REPLACE VIEW public.active_slices       AS SELECT * FROM public.slices       WHERE del_status = false;
-- CREATE OR REPLACE VIEW public.active_stages       AS SELECT * FROM public.stages       WHERE del_status = false;
-- CREATE OR REPLACE VIEW public.active_stage_slices AS SELECT * FROM public.stage_slices WHERE del_status = false;
