import { supabase, isSupabaseConfigured } from '../auth/supabaseClient';
import type { LeaderboardEntry } from './types';
import type { RankingPeriod, RankingRow, RankingType } from './rankingsTypes';
import type { PlayerIdentity } from './playerIdentity';

export function isLeaderboardDbEnabled(): boolean {
  return isSupabaseConfigured && supabase !== null;
}

interface StageLeaderboardRow {
  id: string;
  display_name: string;
  time_ms: number;
  completed_at: string;
  rank: number;
}

interface GlobalRankingRow {
  id: string;
  display_name: string;
  value: number;
  rank: number;
}

export async function insertCompletionEvent(params: {
  identity: PlayerIdentity;
  displayName: string;
  moduleId: string;
  stageId: string;
  timeMs: number;
  perfect: boolean;
}): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from('stage_completion_events').insert({
    player_key: params.identity.playerKey,
    user_id: params.identity.userId,
    guest_id: params.identity.guestId,
    display_name: params.displayName.trim() || '匿名',
    module_id: params.moduleId,
    stage_id: params.stageId,
    time_ms: Math.max(0, Math.floor(params.timeMs)),
    perfect: params.perfect,
  });

  if (error) {
    console.error('[supabaseLeaderboard] insertCompletionEvent:', error.message);
    return false;
  }
  return true;
}

export async function fetchStageLeaderboardFromDb(stageId: string): Promise<LeaderboardEntry[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('get_stage_leaderboard', {
    p_stage_id: stageId,
  });

  if (error) {
    console.error('[supabaseLeaderboard] get_stage_leaderboard:', error.message);
    return null;
  }

  return (data as StageLeaderboardRow[]).map(row => ({
    id: row.id,
    displayName: row.display_name,
    timeMs: row.time_ms,
    completedAt: row.completed_at,
  }));
}

export async function fetchGlobalRankingsFromDb(
  type: RankingType,
  period: RankingPeriod,
  moduleId?: string,
): Promise<RankingRow[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('get_global_rankings', {
    p_type: type,
    p_period: period,
    p_module_id: moduleId ?? null,
  });

  if (error) {
    console.error('[supabaseLeaderboard] get_global_rankings:', error.message);
    return null;
  }

  return (data as GlobalRankingRow[]).map(row => ({
    id: row.id,
    displayName: row.display_name,
    value: Number(row.value),
    rank: Number(row.rank),
  }));
}
