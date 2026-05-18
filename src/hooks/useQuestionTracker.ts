import { useCallback, useRef } from 'react';
import {
  analyzeAttempts,
  type PracticeInsights,
  type QuestionAttempt,
} from '../core/practice/questionTracker';

export function useQuestionTracker() {
  const recordsRef = useRef<QuestionAttempt[]>([]);

  const record = useCallback((attempt: QuestionAttempt) => {
    recordsRef.current.push(attempt);
  }, []);

  const getInsights = useCallback((): PracticeInsights => {
    return analyzeAttempts(recordsRef.current);
  }, []);

  const getAttemptCount = useCallback(() => recordsRef.current.length, []);

  const reset = useCallback(() => {
    recordsRef.current = [];
  }, []);

  return { record, getInsights, getAttemptCount, reset };
}
