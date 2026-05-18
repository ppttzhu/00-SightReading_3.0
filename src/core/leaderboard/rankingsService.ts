import { aggregateRankings } from './rankingsAggregate';
import { recordStageCompletion } from './stageCompletionService';
import type {
  RankingPeriod,
  RankingRow,
  RankingType,
  SubmitRankingEventPayload,
} from './rankingsTypes';
import {
  fetchGlobalRankingsFromDb,
  isLeaderboardDbEnabled,
} from './supabaseLeaderboard';

const LOCAL_EVENTS_KEY = 'sight-reading-ranking-events';

function loadLocalEvents() {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Parameters<typeof aggregateRankings>[0];
  } catch {
    return [];
  }
}

export async function fetchRankings(
  type: RankingType,
  period: RankingPeriod,
  moduleId?: string,
): Promise<RankingRow[]> {
  if (isLeaderboardDbEnabled()) {
    const rows = await fetchGlobalRankingsFromDb(type, period, moduleId);
    if (rows) return rows;
  }

  try {
    const params = new URLSearchParams({ type, period });
    if (moduleId) params.set('moduleId', moduleId);
    const response = await fetch(`/api/rankings?${params}&t=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.rows)) return data.rows as RankingRow[];
    }
  } catch {
    // fallback
  }
  return aggregateRankings(loadLocalEvents(), type, moduleId, period);
}

export async function recordRankingEvent(payload: SubmitRankingEventPayload): Promise<void> {
  await recordStageCompletion({
    authUserId: payload.authUserId,
    displayName: payload.displayName,
    moduleId: payload.moduleId,
    stageId: payload.stageId,
    timeMs: payload.timeMs,
    perfect: payload.perfect,
  });
}
