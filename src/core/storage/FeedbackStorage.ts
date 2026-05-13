export interface FeedbackEntry {
  id: string;
  category: 'feature' | 'bug';
  nickname: string;
  content: string;
  status: 'new' | 'read' | 'resolved';
  timestamp: string;
}

interface FeedbackStore {
  entries: FeedbackEntry[];
  lastUpdated: string;
}

export interface FeedbackStorage {
  getAll(): Promise<FeedbackEntry[]>;
  getResolved(): Promise<FeedbackEntry[]>;
  add(entry: { category: 'feature' | 'bug'; nickname: string; content: string }): Promise<{ id: string }>;
  updateStatus(id: string, status: FeedbackEntry['status']): Promise<void>;
  delete(id: string): Promise<void>;
}

const LOCAL_KEY = 'feedback_local';

class LocalFeedbackStorage implements FeedbackStorage {
  private readStore(): FeedbackStore {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw) as FeedbackStore;
    } catch {
      // fallthrough
    }
    return { entries: [], lastUpdated: new Date().toISOString() };
  }

  private writeStore(store: FeedbackStore): void {
    store.lastUpdated = new Date().toISOString();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  }

  async getAll(): Promise<FeedbackEntry[]> {
    return this.readStore().entries;
  }

  async getResolved(): Promise<FeedbackEntry[]> {
    return this.readStore().entries
      .filter(e => e.status === 'resolved')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async add(entry: { category: 'feature' | 'bug'; nickname: string; content: string }): Promise<{ id: string }> {
    const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newEntry: FeedbackEntry = {
      id,
      category: entry.category,
      nickname: entry.nickname.trim() || '匿名用户',
      content: entry.content.trim(),
      status: 'new',
      timestamp: new Date().toISOString(),
    };
    const store = this.readStore();
    store.entries.unshift(newEntry);
    this.writeStore(store);
    return { id };
  }

  async updateStatus(id: string, status: FeedbackEntry['status']): Promise<void> {
    const store = this.readStore();
    const entry = store.entries.find(e => e.id === id);
    if (!entry) throw new Error('Feedback not found');
    entry.status = status;
    this.writeStore(store);
  }

  async delete(id: string): Promise<void> {
    const store = this.readStore();
    store.entries = store.entries.filter(e => e.id !== id);
    this.writeStore(store);
  }
}

class ApiFeedbackStorage implements FeedbackStorage {
  private authHeader: string;

  constructor() {
    this.authHeader = `Bearer ${import.meta.env.VITE_CMS_SECRET || ''}`;
  }

  async getAll(): Promise<FeedbackEntry[]> {
    const res = await fetch('/api/feedback', {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) throw new Error(`GET failed: ${res.status}`);
    const data = await res.json();
    return data.entries || [];
  }

  async getResolved(): Promise<FeedbackEntry[]> {
    const res = await fetch('/api/feedback/resolved');
    if (!res.ok) throw new Error(`GET resolved failed: ${res.status}`);
    const data = await res.json();
    return data.entries || [];
  }

  async add(entry: { category: 'feature' | 'bug'; nickname: string; content: string }): Promise<{ id: string }> {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(data.error || `POST failed: ${res.status}`);
    }
    return await res.json();
  }

  async updateStatus(id: string, status: FeedbackEntry['status']): Promise<void> {
    const res = await fetch('/api/feedback', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/feedback?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
  }
}

let instance: Promise<FeedbackStorage> | null = null;

async function detectBackend(): Promise<FeedbackStorage> {
  // Try API first
  try {
    const res = await fetch('/api/feedback/resolved', { method: 'HEAD' });
    // Vite dev server returns index.html (text/html) for unknown routes;
    // real API returns 200 with JSON headers. Check Content-Type to avoid false positives.
    const ct = res.headers.get('Content-Type') || '';
    if (res.ok && ct.includes('application/json')) {
      return new ApiFeedbackStorage();
    }
  } catch {
    // Network error — API not available (local dev without wrangler)
  }

  // Fall back to localStorage
  return new LocalFeedbackStorage();
}

/**
 * Get the shared FeedbackStorage instance.
 * On first call, auto-detects whether the API is available;
 * if not, falls back to localStorage for local development.
 */
export function getFeedbackStorage(): Promise<FeedbackStorage> {
  if (!instance) {
    instance = detectBackend();
  }
  return instance;
}

/** Reset the singleton (useful for testing). */
export function resetFeedbackStorage(): void {
  instance = null;
}
