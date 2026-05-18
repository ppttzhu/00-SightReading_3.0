import type { LeaderboardEntry, SubmitScorePayload } from './types';
import { resolvePlayerIdentity } from './playerIdentity';
import { recordStageCompletion } from './stageCompletionService';
import {
  fetchStageLeaderboardFromDb,
  isLeaderboardDbEnabled,
} from './supabaseLeaderboard';

const LOCAL_KEY_PREFIX = 'sight-reading-leaderboard:';
const MAX_ENTRIES = 50;

function localKey(stageId: string) {
  return `${LOCAL_KEY_PREFIX}${stageId}`;
}

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => a.timeMs - b.timeMs || a.completedAt.localeCompare(b.completedAt));
}

function mergeEntry(entries: LeaderboardEntry[], payload: SubmitScorePayload, playerKey: string): LeaderboardEntry[] {
  const next: LeaderboardEntry = {
    id: playerKey,
    displayName: payload.displayName,
    timeMs: payload.timeMs,
    completedAt: new Date().toISOString(),
  };
  const existingIdx = entries.findIndex(e => e.id === playerKey);
  if (existingIdx >= 0) {
    const existing = entries[existingIdx];
    if (payload.timeMs >= existing.timeMs) return entries;
    entries[existingIdx] = next;
  } else {
    entries.push(next);
  }
  return sortEntries(entries).slice(0, MAX_ENTRIES);
}

function loadLocal(stageId: string): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(localKey(stageId));
    if (!raw) return [];
    return sortEntries(JSON.parse(raw) as LeaderboardEntry[]);
  } catch {
    return [];
  }
}

function saveLocal(stageId: string, entries: LeaderboardEntry[]) {
  localStorage.setItem(localKey(stageId), JSON.stringify(entries));
}

export async function fetchLeaderboard(stageId: string): Promise<LeaderboardEntry[]> {
  if (isLeaderboardDbEnabled()) {
    const rows = await fetchStageLeaderboardFromDb(stageId);
    if (rows) return rows;
  }

  try {
    const response = await fetch(`/api/leaderboard?stageId=${encodeURIComponent(stageId)}&t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.entries)) return sortEntries(data.entries);
    }
  } catch {
    // fall through
  }
  return loadLocal(stageId);
}

export async function submitScore(payload: SubmitScorePayload): Promise<LeaderboardEntry[]> {
  const playerKey = resolvePlayerIdentity(payload.authUserId).playerKey;

  await recordStageCompletion({
    authUserId: payload.authUserId,
    displayName: payload.displayName,
    moduleId: payload.moduleId,
    stageId: payload.stageId,
    timeMs: payload.timeMs,
    perfect: payload.perfect ?? true,
  });

  if (isLeaderboardDbEnabled()) {
    const rows = await fetchStageLeaderboardFromDb(payload.stageId);
    if (rows) return rows;
  }

  const localEntries = mergeEntry(loadLocal(payload.stageId), payload, playerKey);
  saveLocal(payload.stageId, localEntries);

  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stageId: payload.stageId,
        displayName: payload.displayName,
        userId: playerKey,
        timeMs: payload.timeMs,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.entries)) {
        saveLocal(payload.stageId, sortEntries(data.entries));
        return sortEntries(data.entries);
      }
    }
  } catch {
    // use local
  }
  return localEntries;
}
