import type { StageData, StorageProvider } from './types';

/**
 * GitHub Gist Storage Provider
 * 
 * Uses a GitHub Gist as a simple JSON store.
 * - Teacher (CMS) writes via GitHub API with a PAT token
 * - Student reads via the public raw URL (no auth needed)
 * 
 * Setup:
 * 1. Create a public gist with a file named "stages.json" (content: {})
 * 2. Generate a PAT with "gist" scope
 * 3. Set VITE_GIST_ID and VITE_GIST_TOKEN in .env
 */

const GIST_FILE_NAME = 'stages.json';

export class GistStorageProvider implements StorageProvider {
  name = 'GitHub Gist';

  private gistId: string;
  private token: string; // Only needed for writes (teacher side)
  private owner: string;

  constructor(config: { gistId: string; token?: string; owner?: string }) {
    this.gistId = config.gistId;
    this.token = config.token || '';
    this.owner = config.owner || '';
  }

  async save(data: StageData): Promise<void> {
    if (!this.token) {
      throw new Error('GitHub token is required to save. Configure VITE_GIST_TOKEN in .env');
    }

    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILE_NAME]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save to Gist: ${response.status} ${error}`);
    }
  }

  async load(): Promise<StageData | null> {
    // Use raw URL for public read (no auth, fast CDN)
    const url = this.owner
      ? `https://gist.githubusercontent.com/${this.owner}/${this.gistId}/raw/${GIST_FILE_NAME}`
      : `https://api.github.com/gists/${this.gistId}`;

    try {
      if (this.owner) {
        // Direct raw file fetch — append timestamp to bust GitHub CDN cache
        const bustUrl = `${url}?t=${Date.now()}`;
        const response = await fetch(bustUrl, {
          cache: 'no-store', // Always get fresh data
        });
        if (!response.ok) return null;
        const text = await response.text();
        if (!text || text === '{}') return null;
        return JSON.parse(text) as StageData;
      } else {
        // Fallback: use API (works without owner, but slower)
        const response = await fetch(url, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-store',
        });
        if (!response.ok) return null;
        const gist = await response.json();
        const file = gist.files?.[GIST_FILE_NAME];
        if (!file?.content) return null;
        const parsed = JSON.parse(file.content);
        if (!parsed.slicesPool) return null;
        return parsed as StageData;
      }
    } catch (e) {
      console.error('[GistStorageProvider] Failed to load:', e);
      return null;
    }
  }
}
