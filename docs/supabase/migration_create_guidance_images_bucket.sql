-- ============================================================
-- Migration: 创建 stage-guidance-images Storage bucket + RLS policies
-- 用途：教师在「学习指导」textarea 上传/拖拽/粘贴的图片落地点
-- 前置依赖：auth.sql（用到 profiles.role）
-- 幂等：可重复运行
-- 在 Supabase Dashboard 的 SQL Editor 里跑
-- 配套 PR：feat(stages): 闯关模式增加学习指导 (#14 v2)
-- ============================================================

-- 1. 创建 bucket（public 读，方便学生端直接 <img src=…> 加载，无需 auth）
insert into storage.buckets (id, name, public)
values ('stage-guidance-images', 'stage-guidance-images', true)
on conflict (id) do nothing;

-- 2. RLS 策略：任何人（含未登录学生）可读
drop policy if exists "guidance_images_public_read" on storage.objects;
create policy "guidance_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'stage-guidance-images');

-- 3. RLS 策略：仅 admin 可上传
drop policy if exists "guidance_images_admin_insert" on storage.objects;
create policy "guidance_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'stage-guidance-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- 4. RLS 策略：仅 admin 可删除（用于将来清理孤儿图片；当前 UI 不暴露删除入口）
drop policy if exists "guidance_images_admin_delete" on storage.objects;
create policy "guidance_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stage-guidance-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
