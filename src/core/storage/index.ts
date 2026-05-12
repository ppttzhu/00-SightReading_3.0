/**
 * Storage module entry point.
 * 
 * To switch providers, change the implementation here.
 * The rest of the app only imports from this file.
 */

export type { StageData, StorageProvider } from './types';
export { GistStorageProvider } from './GistStorageProvider';

import { GistStorageProvider } from './GistStorageProvider';
import type { StorageProvider } from './types';

/**
 * Get the configured storage provider.
 * 
 * To switch to a different backend (Firebase, Supabase, etc.):
 * 1. Create a new class implementing StorageProvider
 * 2. Replace the return value here
 */
export function getStorageProvider(): StorageProvider | null {
  const gistId = import.meta.env.VITE_GIST_ID;

  if (!gistId) {
    console.warn('[Storage] No VITE_GIST_ID configured. Remote sync disabled.');
    return null;
  }

  return new GistStorageProvider({
    gistId,
    token: import.meta.env.VITE_GIST_TOKEN || '',
    owner: import.meta.env.VITE_GIST_OWNER || '',
  });
}
