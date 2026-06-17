-- ============================================================
-- Migration: 关卡评价系统 —— stage_comment + comment_like 表
--
-- 目的：支持学生对关卡写评价、回复、点赞
--   - stage_comment：主评论和回复共用一张表，parent_id 自引用成树
--   - comment_like：点赞关系表，like_count 由触发器自动同步
--
-- 设计决策：
--   - 硬删除（ON DELETE CASCADE），不做软删除
--   - 仅评论作者可删除自己的评论，无管理员通道
--   - user_nickname 反范式化存储，避免依赖 profiles 表的 SELECT 权限
--   - like_count 通过触发器自动同步，保证原子性
--
-- 前置依赖：auth.sql 已执行（依赖 set_updated_at 函数和 profiles 表）
-- 幂等：可重复运行（IF NOT EXISTS / DROP POLICY IF EXISTS）
-- 配套 Change：add-stage-comment
-- ============================================================

-- ============================================================
-- 1. stage_comment 表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stage_comment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id        TEXT NOT NULL,
    user_id         UUID NOT NULL,
    user_nickname   TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    parent_id       UUID REFERENCES public.stage_comment(id) ON DELETE CASCADE,
    like_count      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT content_length CHECK (char_length(content) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_stage_comment_stage
    ON public.stage_comment(stage_id);

CREATE INDEX IF NOT EXISTS idx_stage_comment_parent
    ON public.stage_comment(parent_id);

COMMENT ON TABLE public.stage_comment
    IS '关卡评论；parent_id IS NULL 为主评论，否则为回复，支持多层嵌套';
COMMENT ON COLUMN public.stage_comment.user_nickname
    IS '评论者昵称（写入时从 profiles 冗余存入，避免 JOIN）';
COMMENT ON COLUMN public.stage_comment.parent_id
    IS '被回复的评论 ID；NULL = 主评论，ON DELETE CASCADE 级联删除';
COMMENT ON COLUMN public.stage_comment.like_count
    IS '点赞数（由 comment_like 表的触发器自动维护）';
COMMENT ON COLUMN public.stage_comment.content
    IS '评论正文，长度 1-500 字符';

-- RLS
ALTER TABLE public.stage_comment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_select_all" ON public.stage_comment;
CREATE POLICY "comment_select_all"
    ON public.stage_comment FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "comment_insert_own" ON public.stage_comment;
CREATE POLICY "comment_insert_own"
    ON public.stage_comment FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_delete_own" ON public.stage_comment;
CREATE POLICY "comment_delete_own"
    ON public.stage_comment FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- updated_at 触发器（复用 auth.sql 已定义的 set_updated_at 函数）
DROP TRIGGER IF EXISTS stage_comment_set_updated_at ON public.stage_comment;
CREATE TRIGGER stage_comment_set_updated_at
    BEFORE UPDATE ON public.stage_comment
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 2. comment_like 表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comment_like (
    comment_id  UUID NOT NULL REFERENCES public.stage_comment(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
);

COMMENT ON TABLE public.comment_like
    IS '评论点赞关系；联合主键防止重复点赞';

-- RLS
ALTER TABLE public.comment_like ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "like_select_all" ON public.comment_like;
CREATE POLICY "like_select_all"
    ON public.comment_like FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "like_insert_own" ON public.comment_like;
CREATE POLICY "like_insert_own"
    ON public.comment_like FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "like_delete_own" ON public.comment_like;
CREATE POLICY "like_delete_own"
    ON public.comment_like FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);


-- ============================================================
-- 3. like_count 自动同步触发器
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_comment_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.stage_comment
        SET like_count = like_count + 1
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.stage_comment
        SET like_count = like_count - 1
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.sync_comment_like_count()
    IS 'comment_like INSERT/DELETE 时自动同步 stage_comment.like_count；SECURITY DEFINER 绕过 RLS';

DROP TRIGGER IF EXISTS trg_comment_like_sync ON public.comment_like;
CREATE TRIGGER trg_comment_like_sync
    AFTER INSERT OR DELETE ON public.comment_like
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_comment_like_count();
