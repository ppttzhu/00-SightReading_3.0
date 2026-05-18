interface Env {
  STAGES_KV: KVNamespace;
}

interface LeaderboardEntry {
  id: string;
  displayName: string;
  timeMs: number;
  completedAt: string;
}

interface SubmitBody {
  stageId: string;
  displayName: string;
  userId: string;
  timeMs: number;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

const MAX_ENTRIES = 50;

function kvKey(stageId: string) {
  return `leaderboard:${stageId}`;
}

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => a.timeMs - b.timeMs || a.completedAt.localeCompare(b.completedAt));
}

function mergeEntry(entries: LeaderboardEntry[], body: SubmitBody): LeaderboardEntry[] {
  const next: LeaderboardEntry = {
    id: body.userId,
    displayName: body.displayName.trim() || '匿名',
    timeMs: Math.max(0, Math.floor(body.timeMs)),
    completedAt: new Date().toISOString(),
  };
  const existingIdx = entries.findIndex(e => e.id === body.userId);
  if (existingIdx >= 0) {
    if (next.timeMs >= entries[existingIdx].timeMs) return entries;
    entries[existingIdx] = next;
  } else {
    entries.push(next);
  }
  return sortEntries(entries).slice(0, MAX_ENTRIES);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const stageId = new URL(request.url).searchParams.get('stageId');
    if (!stageId) {
      return new Response(JSON.stringify({ error: 'stageId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const raw = await env.STAGES_KV.get(kvKey(stageId), 'text');
      const entries = raw ? sortEntries(JSON.parse(raw) as LeaderboardEntry[]) : [];
      return new Response(JSON.stringify({ entries }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json() as SubmitBody;
      if (!body.stageId || !body.userId || typeof body.timeMs !== 'number') {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const raw = await env.STAGES_KV.get(kvKey(body.stageId), 'text');
      const existing = raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
      const entries = mergeEntry(existing, body);
      await env.STAGES_KV.put(kvKey(body.stageId), JSON.stringify(entries));

      return new Response(JSON.stringify({ entries }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};
