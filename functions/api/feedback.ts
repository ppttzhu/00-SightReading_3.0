interface Env {
  STAGES_KV: KVNamespace;
  CMS_SECRET: string;
}

interface FeedbackEntry {
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

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function checkAuth(request: Request, env: Env): boolean {
  if (!env.CMS_SECRET) return true;
  const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  return authToken === env.CMS_SECRET;
}

async function getFeedbackStore(env: Env): Promise<FeedbackStore> {
  const data = await env.STAGES_KV.get('feedback', 'text');
  if (data) {
    try {
      return JSON.parse(data) as FeedbackStore;
    } catch {
      // fallthrough
    }
  }
  return { entries: [], lastUpdated: new Date().toISOString() };
}

async function saveFeedbackStore(env: Env, store: FeedbackStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await env.STAGES_KV.put('feedback', JSON.stringify(store));
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // POST: anonymous submission
  if (request.method === 'POST') {
    try {
      const body = await request.json() as Record<string, unknown>;
      const category = body.category;
      const content = String(body.content || '');
      const nickname = String(body.nickname || '').trim();

      if (category !== 'feature' && category !== 'bug') {
        return jsonResponse({ error: 'Invalid category. Must be "feature" or "bug".' }, 400);
      }

      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return jsonResponse({ error: 'Content is required.' }, 400);
      }
      if (trimmedContent.length > 5000) {
        return jsonResponse({ error: 'Content must not exceed 5000 characters.' }, 400);
      }

      const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const entry: FeedbackEntry = {
        id,
        category,
        nickname: nickname || '匿名用户',
        content: trimmedContent,
        status: 'new',
        timestamp: new Date().toISOString(),
      };

      const store = await getFeedbackStore(env);
      store.entries.unshift(entry);
      await saveFeedbackStore(env, store);

      return jsonResponse({ success: true, id });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return jsonResponse({ error: message }, 500);
    }
  }

  // GET: list all (auth required)
  if (request.method === 'GET') {
    if (!checkAuth(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
      const store = await getFeedbackStore(env);
      return jsonResponse({ entries: store.entries, lastUpdated: store.lastUpdated });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return jsonResponse({ error: message }, 500);
    }
  }

  // PATCH: update status (auth required)
  if (request.method === 'PATCH') {
    if (!checkAuth(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
      const body = await request.json() as Record<string, unknown>;
      const id = String(body.id || '');
      const status = body.status;

      if (!id) {
        return jsonResponse({ error: 'id is required.' }, 400);
      }
      if (status !== 'new' && status !== 'read' && status !== 'resolved') {
        return jsonResponse({ error: 'Invalid status. Must be "new", "read", or "resolved".' }, 400);
      }

      const store = await getFeedbackStore(env);
      const entry = store.entries.find(e => e.id === id);
      if (!entry) {
        return jsonResponse({ error: 'Feedback not found.' }, 404);
      }

      entry.status = status;
      await saveFeedbackStore(env, store);

      return jsonResponse({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return jsonResponse({ error: message }, 500);
    }
  }

  // DELETE: remove entry (auth required)
  if (request.method === 'DELETE') {
    if (!checkAuth(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');

      if (!id) {
        return jsonResponse({ error: 'id query parameter is required.' }, 400);
      }

      const store = await getFeedbackStore(env);
      const initialLen = store.entries.length;
      store.entries = store.entries.filter(e => e.id !== id);

      if (store.entries.length === initialLen) {
        return jsonResponse({ error: 'Feedback not found.' }, 404);
      }

      await saveFeedbackStore(env, store);
      return jsonResponse({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return jsonResponse({ error: message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
};
