/**
 * Storage module entry point.
 *
 * Uses Cloudflare KV storage via Pages Functions API route.
 * The rest of the app only imports from this file.
 */

export type { StageData, StorageProvider } from './types';
export { CloudflareStorageProvider } from './CloudflareStorageProvider';

import { CloudflareStorageProvider } from './CloudflareStorageProvider';
import type { StorageProvider } from './types';

/**
 * Get the configured storage provider.
 *
 * Uses Cloudflare KV via /api/stages endpoint.
 * Set VITE_CMS_SECRET in .env for teacher write access.
 */
export function getStorageProvider(): StorageProvider | null {
  return new CloudflareStorageProvider({
    cmsSecret: import.meta.env.VITE_CMS_SECRET || '',
  });
}
