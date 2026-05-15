/**
 * Storage module entry point.
 *
 * Uses Cloudflare KV storage via Pages Functions API route.
 * In dev mode, loads from a local JSON file instead.
 * The rest of the app only imports from this file.
 */

export type { StageData, StorageProvider } from './types';
export { CloudflareStorageProvider } from './CloudflareStorageProvider';

import { CloudflareStorageProvider } from './CloudflareStorageProvider';
import type { StorageProvider, StageData } from './types';

/**
 * Local file storage provider for dev/testing.
 * Reads from /stages-local-test.json (served by Vite from public/).
 * Save is a no-op (use CMS in production to publish).
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
 * Get the configured storage provider.
 *
 * - Dev mode: reads from /stages-local-test.json (local file)
 * - Production: uses Cloudflare KV via /api/stages endpoint
 */
export function getStorageProvider(): StorageProvider | null {
  if (import.meta.env.DEV) {
    return new LocalFileStorageProvider();
  }
  return new CloudflareStorageProvider({
    cmsSecret: import.meta.env.VITE_CMS_SECRET || '',
  });
}
