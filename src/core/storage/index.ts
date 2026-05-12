/**
 * Storage module entry point.
 *
 * Uses Vercel Blob storage via serverless API route.
 * The rest of the app only imports from this file.
 */

export type { StageData, StorageProvider } from './types';
export { VercelStorageProvider } from './VercelStorageProvider';

import { VercelStorageProvider } from './VercelStorageProvider';
import type { StorageProvider } from './types';

/**
 * Get the configured storage provider.
 *
 * Uses Vercel Blob via /api/stages endpoint.
 * Set VITE_CMS_SECRET in .env for teacher write access.
 */
export function getStorageProvider(): StorageProvider | null {
  return new VercelStorageProvider({
    cmsSecret: import.meta.env.VITE_CMS_SECRET || '',
  });
}
