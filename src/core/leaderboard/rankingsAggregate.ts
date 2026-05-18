import type { RankingEvent, RankingPeriod, RankingRow, RankingType } from './rankingsTypes';
import { getPeriodStart } from './periodUtils';

function filterEvents(
  events: RankingEvent[],
  moduleId: string | undefined,
  period: RankingPeriod,
): RankingEvent[] {
  const start = getPeriodStart(period).toISOString();
  return events.filter(e =>
    e.perfect &&
    e.completedAt >= start &&
    (!moduleId || e.moduleId === moduleId),
  );
}

export function aggregateRankings(
  events: RankingEvent[],
  type: RankingType,
  moduleId: string | undefined,
  period: RankingPeriod,
): RankingRow[] {
  const filtered = filterEvents(events, moduleId, period);
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
