import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../core/auth/AuthProvider';
import { supabase } from '../core/auth/supabaseClient';

export type QuizModule = 'notes' | 'symbols' | 'theory' | 'patterns';

export interface UserSliceStatsRecord {
  quizId: string;
  module: QuizModule;
  displayLabel: string;
  totalCount: number;
  correctCount: number;
  wrongCount: number;
  errorRate: number;
  lastPracticedAt: string | null;
}

const MODULE_LABELS: Record<QuizModule, string> = {
  notes: '单音',
  symbols: '记号',
  theory: '音程',
  patterns: '音型',
};

const SYMBOL_MAP: Record<string, string> = {
  p: 'Piano (弱)', pp: 'Pianissimo (很弱)', ppp: 'Pianississimo (极弱)',
  f: 'Forte (强)', ff: 'Fortissimo (很强)', fff: 'Fortississimo (极强)',
  mp: 'Mezzo Piano (中弱)', mf: 'Mezzo Forte (中强)',
  cresc: 'Crescendo (渐强)', decresc: 'Decrescendo (渐弱)',
  dim: 'Diminuendo (渐弱)', sfz: 'Sforzando (突强)',
  fp: 'Forte Piano (强后弱)', fz: 'Forzando (突强)',
};

/**
 * Parse quiz content JSONB into a human-readable label based on module type.
 */
function parseQuizContent(module: QuizModule, content: Record<string, unknown>): string {
  switch (module) {
    case 'notes':
      return (content.raw as string) || (content.pitch as string) || '?';
    case 'symbols': {
      const raw = (content.raw as string) || (content.symbol as string) || '';
      return SYMBOL_MAP[raw] || raw || '?';
    }
    case 'theory':
      return (content.theory as string) || (content.raw as string) || '?';
    case 'patterns':
      return (content.raw as string) || (content.pattern as string) || '?';
    default:
      return '?';
  }
}

interface UseUserSliceStatsResult {
  data: UserSliceStatsRecord[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useUserSliceStats(page?: number, pageSize?: number): UseUserSliceStatsResult {
  const { user } = useAuth();
  const [allRecords, setAllRecords] = useState<UserSliceStatsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const fetchData = useCallback(async () => {
    if (!supabase || !user) {
      setAllRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_slice_stats')
        .select('quiz_id, total_count, correct_count, wrong_count, last_practiced_at')
        .eq('user_id', user.id);

      if (statsError) throw new Error(statsError.message);
      if (!statsData || statsData.length === 0) {
        setAllRecords([]);
        setLoading(false);
        return;
      }

      // Fetch quiz details for all quiz_ids
      const quizIds = statsData.map((r) => r.quiz_id);
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, module, content')
        .in('id', quizIds);

      if (quizError) throw new Error(quizError.message);

      // Build a lookup map: quiz_id → { module, content }
      const quizMap = new Map<string, { module: QuizModule; content: Record<string, unknown> }>();
      for (const q of quizData || []) {
        quizMap.set(q.id, { module: q.module as QuizModule, content: q.content as Record<string, unknown> });
      }

      const records: UserSliceStatsRecord[] = statsData.map((row) => {
        const totalCount = row.total_count ?? 0;
        const wrongCount = row.wrong_count ?? 0;
        const errorRate = totalCount > 0 ? wrongCount / totalCount : 0;
        const quiz = quizMap.get(row.quiz_id);
        const module: QuizModule = quiz?.module ?? 'notes';
        const displayLabel = quiz
          ? `[${MODULE_LABELS[module]}] ${parseQuizContent(module, quiz.content)}`
          : row.quiz_id;

        return {
          quizId: row.quiz_id,
          module,
          displayLabel,
          totalCount,
          correctCount: row.correct_count ?? 0,
          wrongCount,
          errorRate,
          lastPracticedAt: row.last_practiced_at,
        };
      });

      // Sort by error rate descending, then by total_count descending as tiebreaker
      records.sort((a, b) => {
        if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
        return b.totalCount - a.totalCount;
      });

      setAllRecords(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败，请稍后重试。');
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user, fetchKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  // Client-side pagination (optional — if page/pageSize not provided, return all)
  const totalCount = allRecords.length;
  const data = (page && pageSize)
    ? allRecords.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    : allRecords;

  return { data, totalCount, loading, error, retry };
}
