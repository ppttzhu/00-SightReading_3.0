import { supabase } from '../core/auth/supabaseClient';

const BUCKET = 'stage-guidance-images';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export class GuidanceImageUploadError extends Error {}

function pickExtension(file: File): string {
  const dotIndex = file.name.lastIndexOf('.');
  if (dotIndex > 0 && dotIndex < file.name.length - 1) {
    return file.name.slice(dotIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  // Fallback from MIME type (e.g. image/png → png)
  const slash = file.type.lastIndexOf('/');
  if (slash >= 0) return file.type.slice(slash + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return 'bin';
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Upload an image file to Supabase Storage and return its public URL.
 *
 * Validates type (must be image/*) and size (<= 2 MB). Stores under
 * a random path so multiple stages can share the bucket without collisions.
 * Image objects are NOT cleaned up when guidance text is deleted — leaving
 * orphan cleanup as a follow-up admin tool.
 */
export async function uploadGuidanceImage(file: File): Promise<string> {
  if (!supabase) {
    throw new GuidanceImageUploadError('Supabase 未配置，无法上传图片');
  }
  if (!file.type.startsWith('image/')) {
    throw new GuidanceImageUploadError(`不支持的文件类型：${file.type || '未知'}`);
  }
  if (file.size > MAX_BYTES) {
    throw new GuidanceImageUploadError(`图片过大（${(file.size / 1024 / 1024).toFixed(1)} MB），最大 2 MB`);
  }

  const path = `${randomId()}.${pickExtension(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    throw new GuidanceImageUploadError(`上传失败：${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
