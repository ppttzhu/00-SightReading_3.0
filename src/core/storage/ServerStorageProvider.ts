import type { StageData, StorageProvider } from './types';

export class ServerStorageProvider implements StorageProvider {
  name = 'Server JSON Storage';

  private endpoint: string;

  constructor(endpoint = import.meta.env.VITE_SERVER_STORAGE_URL || '/api/stage-data') {
    this.endpoint = endpoint;
  }

  async save(data: StageData): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin',
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`Server save failed (${response.status}): ${message || response.statusText}`);
    }
  }

  async load(): Promise<StageData | null> {
    const response = await fetch(this.endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`Server load failed (${response.status}): ${message || response.statusText}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.slicesPool) || !Array.isArray(data.customStages)) return null;
    return data as StageData;
  }
}
