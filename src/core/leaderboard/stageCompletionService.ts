import { resolvePlayerIdentity } from './playerIdentity';
import {
  insertCompletionEvent,
  isLeaderboardDbEnabled,
} from './supabaseLeaderboard';

export interface RecordStageCompletionPayload {
  authUserId?: string | null;
  displayName: string;
  moduleId: string;
  stageId: string;
  timeMs: number;
  perfect?: boolean;
}

const LOCAL_EVENTS_KEY = 'sight-reading-ranking-events';

function appendLocalEvent(payload: RecordStageCompletionPayload, identity: ReturnType<typeof resolvePlayerIdentity>) {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.push({
      userId: identity.playerKey,
      displayName: payload.displayName,
      moduleId: payload.moduleId,
      stageId: payload.stageId,
      timeMs: payload.timeMs,
      perfect: payload.perfect ?? true,
      completedAt: new Date().toISOString(),
    });
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events.slice(-2000)));
  } catch {
    // ignore
  }
}

/** 写入通关记录（Supabase 优先，否则 localStorage 兜底） */
export async function recordStageCompletion(payload: RecordStageCompletionPayload): Promise<void> {
  const identity = resolvePlayerIdentity(payload.authUserId);
  const perfect = payload.perfect ?? true;

  if (isLeaderboardDbEnabled()) {
    const ok = await insertCompletionEvent({
      identity,
      displayName: payload.displayName,
      moduleId: payload.moduleId,
      stageId: payload.stageId,
      timeMs: payload.timeMs,
      perfect,
    });
    if (ok) return;
  }

  appendLocalEvent(payload, identity);

  try {
    await fetch('/api/rankings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: identity.playerKey,
        displayName: payload.displayName,
        moduleId: payload.moduleId,
        stageId: payload.stageId,
        timeMs: payload.timeMs,
        perfect,
      }),
    });
  } catch {
    // local only
  }
}
