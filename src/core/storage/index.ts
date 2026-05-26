/**
 * Storage module entry point.
 *
 * 生产 / 预览：使用 SupabaseStorageProvider（slices/stages/stage_slices 三张表）
 * 开发环境：可读 /stages-local-test.json 作为种子，但发布走 Supabase
 *
 * 旧的 CloudflareStorageProvider 仍保留代码以备回滚，但默认不再启用。
 */

export type { StageData, StorageProvider } from './types';

import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { CloudflareStorageProvider } from './CloudflareStorageProvider';
import { ServerStorageProvider } from './ServerStorageProvider';
import { isSupabaseConfigured } from '../auth/supabaseClient';
import type { StorageProvider, StageData } from './types';

export { SupabaseStorageProvider, CloudflareStorageProvider, ServerStorageProvider };

/**
 * Local file storage provider for dev/testing.
 * 读 /stages-local-test.json（Vite 从 public/ 提供），save 是 no-op。
 */
class LocalFileStorageProvider implements StorageProvider {
  name = 'Local File (dev)';

  async save(_data: StageData): Promise<void> {
    console.warn('[LocalFileStorageProvider] save() is a no-op in dev mode');
  }

  async load(): Promise<StageData | null> {
    try {
      const response = await fetch('/stages-local-test.json');
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || !data.slicesPool) return null;
      return data as StageData;
    } catch (e) {
      console.error('[LocalFileStorageProvider] Failed to load:', e);
      return null;
    }
  }
}

/**
 * 选择当前生效的 StorageProvider。
 *
 * 优先级：
 *   1. VITE_STORAGE_PROVIDER 显式指定（"supabase" | "cloudflare" | "local"），用于回滚
 *   2. Supabase 已配置 → SupabaseStorageProvider
 *   3. DEV 模式 → LocalFileStorageProvider
 *   4. 否则 → CloudflareStorageProvider（向后兼容）
 */
export function getStorageProvider(): StorageProvider | null {
  const override = (import.meta.env.VITE_STORAGE_PROVIDER || '').toLowerCase();

  if (override === 'supabase') return new SupabaseStorageProvider();
  if (override === 'server') return new ServerStorageProvider();
  if (override === 'local') return new LocalFileStorageProvider();
  if (override === 'cloudflare') {
    return new CloudflareStorageProvider({
      cmsSecret: import.meta.env.VITE_CMS_SECRET || '',
    });
  }

  if (isSupabaseConfigured) {
    return new SupabaseStorageProvider();
  }

  if (import.meta.env.DEV) {
    return new LocalFileStorageProvider();
  }

  return new CloudflareStorageProvider({
    cmsSecret: import.meta.env.VITE_CMS_SECRET || '',
  });
}
