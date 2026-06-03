-- ============================================================
-- Migration: adventure_routes 表加 guidance 和 guidance_images 列
-- + 新建 adventure_guidance_images 表
-- 前置依赖：migration_add_adventure_paths.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS / IF NOT EXISTS）
-- 配套 Change：refactor-adventure-guidance
-- ============================================================

-- 1. adventure_routes 加 guidance 列
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS guidance TEXT;

COMMENT ON COLUMN public.adventure_routes.guidance IS '冒险关卡学习指导 Markdown 文本；用 {image:id} 占位符引用图片';

-- 2. adventure_routes 加 guidance_images 列（JSONB 数组）
ALTER TABLE public.adventure_routes
    ADD COLUMN IF NOT EXISTS guidance_images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.adventure_routes.guidance_images IS '冒险关卡学习指导中的图片列表，格式：[{id, url, alt, fileSize}]';

-- 3. 新建 adventure_guidance_images 表
CREATE TABLE IF NOT EXISTS public.adventure_guidance_images (
    id TEXT PRIMARY KEY,
    stage_id TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    alt_text TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adventure_guidance_images_stage_id
    ON public.adventure_guidance_images(stage_id);

COMMENT ON TABLE public.adventure_guidance_images IS '冒险关卡学习指导图片元数据；每行代表一张图片，关联到冒险关卡';
COMMENT ON COLUMN public.adventure_guidance_images.id IS '图片短 ID，如 img_a1b2c3d4，在 guidance markdown 中以 {image:id} 引用';
COMMENT ON COLUMN public.adventure_guidance_images.stage_id IS '关联的冒险关卡 ID（adventure_routes 的 source_stage_id 派生 ID）';
COMMENT ON COLUMN public.adventure_guidance_images.storage_path IS 'Supabase Storage 中的路径';
COMMENT ON COLUMN public.adventure_guidance_images.public_url IS '完整可公开访问的图片 URL';

-- 4. RLS 策略：任何人可读
ALTER TABLE public.adventure_guidance_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_guidance_images_select_all" ON public.adventure_guidance_images;
CREATE POLICY "adventure_guidance_images_select_all"
    ON public.adventure_guidance_images FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "adventure_guidance_images_admin_write" ON public.adventure_guidance_images;
CREATE POLICY "adventure_guidance_images_admin_write"
    ON public.adventure_guidance_images FOR ALL
    TO authenticated
    USING      (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- 5. 迁移现有数据：将 description（旧数据中存的是 guidance 内容）复制到 guidance
UPDATE public.adventure_routes
SET guidance = description
WHERE guidance IS NULL AND description IS NOT NULL AND description != '';
