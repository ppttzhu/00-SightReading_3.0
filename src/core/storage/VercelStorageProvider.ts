import type { StageData, StorageProvider } from './types';

/**
 * Vercel Blob Storage Provider
 *
 * Uses a Vercel serverless API route (/api/stages) as the backend.
 * - Teacher (CMS) writes via POST with a secret token
 * - Student reads via GET (no auth needed, no caching)
 *
 * Setup:
 * 1. Add BLOB_READ_WRITE_TOKEN to Vercel environment variables (from Vercel Blob store)
 * 2. Optionally add CMS_SECRET for write protection
 * 3. Set VITE_CMS_SECRET in .env for the teacher side
 */

export class VercelStorageProvider implements StorageProvider {
  name = 'Vercel Blob';

  private apiBase: string;
  private cmsSecret: string;

  constructor(config: { apiBase?: string; cmsSecret?: string }) {
    // Use relative URL so it works in both dev and production
    this.apiBase = config.apiBase || '/api/stages';
    this.cmsSecret = config.cmsSecret || '';
  }

  async save(data: StageData): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.cmsSecret) {
      headers['Authorization'] = `Bearer ${this.cmsSecret}`;
    }

    const response = await fetch(this.apiBase, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save: ${response.status} ${error}`);
    }
  }

  async load(): Promise<StageData | null> {
    try {
      const response = await fetch(`${this.apiBase}?t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data || !data.slicesPool) return null;
      return data as StageData;
    } catch (e) {
      console.error('[VercelStorageProvider] Failed to load:', e);
      return null;
    }
  }
}
