import type { StageData, StorageProvider } from './types';

/**
 * @deprecated 已被 SupabaseStorageProvider 替换；保留代码以便回滚（VITE_STORAGE_PROVIDER=cloudflare）。
 *
 * Cloudflare KV Storage Provider
 *
 * Uses a Cloudflare Pages Function (/api/stages) as the backend.
 * - Teacher (CMS) writes via POST with a secret token
 * - Student reads via GET (no auth needed, no caching)
 *
 * Setup:
 * 1. Create a KV namespace: `npx wrangler kv namespace create STAGES_KV`
 * 2. Add the namespace ID to wrangler.toml
 * 3. Set CMS_SECRET via `npx wrangler pages secret put CMS_SECRET`
 * 4. Set VITE_CMS_SECRET in .env for the teacher side
 */

export class CloudflareStorageProvider implements StorageProvider {
  name = 'Cloudflare KV';

  private apiBase: string;
  private cmsSecret: string;

  constructor(config: { apiBase?: string; cmsSecret?: string }) {
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
      console.error('[CloudflareStorageProvider] Failed to load:', e);
      return null;
    }
  }
}
