-- ============================================================
-- Migration: 移除 practice_records.module 的 CHECK 约束
-- 目的：module 之前被限制为 notes/symbols/theory/patterns，
--       新增题型（如 chords）时插入会被拒绝。移除该约束后，
--       module 变为自由文本，未来新增题型无需再改数据库。
-- 幂等：可重复运行（找不到约束时跳过）。
-- ============================================================

DO $$
DECLARE c text;
BEGIN
  -- 找到 practice_records 上任何引用 module 列的 CHECK 约束并删除
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.practice_records'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%module%';

  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.practice_records DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- 说明：module 列仍为 NOT NULL 文本；应用层始终写入一个模块字符串
-- （notes / symbols / theory / chords / patterns / …）。
