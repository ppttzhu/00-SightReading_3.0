interface Env {
  STAGES_KV: KVNamespace;
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    try {
      const data = await env.STAGES_KV.get('feedback', 'text');
      if (!data) {
        return jsonResponse({ entries: [], lastUpdated: new Date().toISOString() });
      }

      const store = JSON.parse(data) as FeedbackStore;
      const resolvedEntries = store.entries
        .filter(e => e.status === 'resolved')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return jsonResponse({ entries: resolvedEntries, lastUpdated: store.lastUpdated });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return jsonResponse({ error: message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
};
