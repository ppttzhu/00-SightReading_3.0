interface Env {
  STAGES_KV: KVNamespace;
}

interface RankingEvent {
  userId: string;
  displayName: string;
  moduleId: string;
  stageId: string;
  timeMs: number;
  perfect: boolean;
  completedAt: string;
}

interface SubmitBody {
  userId: string;
  displayName: string;
  moduleId: string;
  stageId: string;
  timeMs: number;
  perfect: boolean;
}

type RankingType = 'ability' | 'effort';
type RankingPeriod = 'week' | 'month' | 'year';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

const EVENTS_KEY = 'ranking-events';
const MAX_EVENTS = 5000;

function getPeriodStart(period: RankingPeriod, now = new Date()): Date {
  if (period === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function aggregateRankings(
  events: RankingEvent[],
  type: RankingType,
  moduleId: string | null,
  period: RankingPeriod,
) {
  const start = getPeriodStart(period).toISOString();
  const filtered = events.filter(e =>
    e.perfect &&
    e.completedAt >= start &&
    (!moduleId || e.moduleId === moduleId),
  );

  const byUser = new Map<string, { displayName: string; bestTime: number; count: number }>();
  for (const e of filtered) {
    const prev = byUser.get(e.userId);
    if (!prev) {
      byUser.set(e.userId, { displayName: e.displayName, bestTime: e.timeMs, count: 1 });
    } else {
      prev.bestTime = Math.min(prev.bestTime, e.timeMs);
      prev.count += 1;
      if (e.displayName) prev.displayName = e.displayName;
    }
  }

  const rows = [...byUser.entries()].map(([id, v]) => ({
    id,
    displayName: v.displayName,
    value: type === 'ability' ? v.bestTime : v.count,
    rank: 0,
  }));

  rows.sort((a, b) => (type === 'ability' ? a.value - b.value : b.value - a.value));
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

async function loadEvents(env: Env): Promise<RankingEvent[]> {
  const raw = await env.STAGES_KV.get(EVENTS_KEY, 'text');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RankingEvent[];
  } catch {
    return [];
  }
}

async function saveEvents(env: Env, events: RankingEvent[]) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString();
  const trimmed = events.filter(e => e.completedAt >= cutoff).slice(-MAX_EVENTS);
  await env.STAGES_KV.put(EVENTS_KEY, JSON.stringify(trimmed));
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') as RankingType | null;
    const period = (url.searchParams.get('period') || 'week') as RankingPeriod;
    const moduleId = url.searchParams.get('moduleId');

    if (type !== 'ability' && type !== 'effort') {
      return new Response(JSON.stringify({ error: 'type must be ability or effort' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const events = await loadEvents(env);
      const rows = aggregateRankings(events, type, moduleId, period);
      return new Response(JSON.stringify({ rows }), {
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
      if (!body.userId || !body.moduleId || !body.stageId || typeof body.timeMs !== 'number') {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const events = await loadEvents(env);
      events.push({
        userId: body.userId,
        displayName: (body.displayName || '匿名').trim(),
        moduleId: body.moduleId,
        stageId: body.stageId,
        timeMs: Math.max(0, Math.floor(body.timeMs)),
        perfect: Boolean(body.perfect),
        completedAt: new Date().toISOString(),
      });
      await saveEvents(env, events);

      return new Response(JSON.stringify({ success: true }), {
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
