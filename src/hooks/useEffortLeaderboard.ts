import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../core/auth/AuthProvider';
import { supabase } from '../core/auth/supabaseClient';

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  totalPracticeCount: number;
  rank: number;
}

interface UseEffortLeaderboardResult {
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Calculate rolling 7-day window boundaries.
 * Returns week_start (now - 7 days) and week_end (now).
 */
function getRolling7DayBoundaries(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    weekStart: sevenDaysAgo.toISOString(),
    weekEnd: now.toISOString(),
  };
}

/**
 * Compute ranks with tie handling.
 * Same totalPracticeCount = same rank, next rank skips.
 * e.g., counts [10, 8, 8, 5] → ranks [1, 2, 2, 4]
 */
function computeRanks(entries: Omit<LeaderboardEntry, 'rank'>[]): LeaderboardEntry[] {
  const ranked: LeaderboardEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].totalPracticeCount < entries[i - 1].totalPracticeCount) {
      currentRank = i + 1;
    }
    ranked.push({ ...entries[i], rank: currentRank });
  }

  return ranked;
}

export function useEffortLeaderboard(): UseEffortLeaderboardResult {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const fetchData = useCallback(async () => {
    if (!supabase || !user) {
      setEntries([]);
      setCurrentUserEntry(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { weekStart, weekEnd } = getRolling7DayBoundaries();

      const { data, error: rpcError } = await supabase.rpc('get_effort_leaderboard', {
        week_start: weekStart,
        week_end: weekEnd,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Map RPC results to entries (already sorted by total_count DESC from the DB)
      const unranked: Omit<LeaderboardEntry, 'rank'>[] = (data || []).map((row: { user_id: string; nickname: string; total_count: number }) => ({
        userId: row.user_id,
        nickname: row.nickname,
        totalPracticeCount: Number(row.total_count),
      }));

      // Compute ranks with tie handling
      const ranked = computeRanks(unranked);
      setEntries(ranked);

      // Find current user's entry
      const userEntry = ranked.find((e) => e.userId === user.id) ?? null;

      if (userEntry) {
        setCurrentUserEntry(userEntry);
      } else {
        // Current user has 0 practice count — create synthetic entry
        setCurrentUserEntry({
          userId: user.id,
          nickname: profile?.nickname ?? '',
          totalPracticeCount: 0,
          rank: ranked.length + 1,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败，请稍后重试。');
      setEntries([]);
      setCurrentUserEntry(null);
    } finally {
      setLoading(false);
    }
  }, [user, profile, fetchKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return { entries, currentUserEntry, loading, error, retry };
}
