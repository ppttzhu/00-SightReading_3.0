import { supabase } from '../core/auth/supabaseClient';

const BUCKET = 'stage-guidance-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export class GuidanceImageUploadError extends Error {}

export interface UploadResult {
  url: string;
  imageId: string;
}

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

function shortId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `img_${rand}`;
}

/**
 * Upload an image file to Supabase Storage, optionally record in adventure_guidance_images table,
 * and return public URL + image ID.
 */
export async function uploadGuidanceImage(file: File, stageId?: string): Promise<UploadResult> {
  if (!supabase) {
    throw new GuidanceImageUploadError('Supabase 未配置，无法上传图片');
  }
  if (!file.type.startsWith('image/')) {
    throw new GuidanceImageUploadError(`不支持的文件类型：${file.type || '未知'}`);
  }
  if (file.size > MAX_BYTES) {
    throw new GuidanceImageUploadError(`图片过大（${(file.size / 1024 / 1024).toFixed(1)} MB），最大 5 MB`);
  }

  const storagePath = `${randomId()}.${pickExtension(file)}`;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (uploadErr) {
    throw new GuidanceImageUploadError(`上传失败：${uploadErr.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;
  const imageId = shortId();

  // Optionally record in adventure_guidance_images table
  if (stageId) {
    const { error: dbErr } = await supabase
      .from('adventure_guidance_images')
      .insert({
        id: imageId,
        stage_id: stageId,
        storage_path: storagePath,
        public_url: publicUrl,
        alt_text: file.name.replace(/\.[^.]+$/, '').replace(/[[\]\r\n]/g, ' ').trim() || 'image',
        file_size: file.size,
      } as never);
    if (dbErr) {
      console.warn('[uploadGuidanceImage] DB insert failed:', dbErr.message);
      // Don't throw — Storage upload succeeded, image is usable
    }
  }

  return { url: publicUrl, imageId };
}

export async function deleteGuidanceImage(imageId: string, stageId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('adventure_guidance_images')
    .delete()
    .eq('id', imageId)
    .eq('stage_id', stageId);
  if (error) {
    console.warn('[deleteGuidanceImage]', error.message);
  }
}
